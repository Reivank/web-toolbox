
/**
 * @template T
 * @template S
 * @param {{getElementById(id: string): S}} parent
 * @param {string} id
 * @param {{new(): T}} type
 */
const requireElement = (parent, id, type) => {
    const result = parent.getElementById(id);
    if(result === null) {
        throw new Error(`not found element #${id}`);
    } else if(result instanceof type) {
        return result;
    } else {
        throw new Error(`element #${id} is not instance of ${type}`);
    }
};

class ColorPointEditorRow {
    /** @type {number} */
    #position;
    /** @type {string} */
    #color;
    /** @type {HTMLTableRowElement} @readonly */
    rowElement;
    /** @type {((position: number, color: string) => void) | null} */
    onUpdate = null;
    /** @type {(() => void) | null} */
    onClickInsert = null;
    /** @type {(() => void) | null} */
    onClickDelete = null;

    /**
     * @param {number} position
     * @param {string} color
     */
    constructor(position, color) {
        const row = document.createElement('tr');

        const positionInput = document.createElement('input');
        positionInput.id = 'position';
        positionInput.type = 'number';
        positionInput.value = `${position}`;
        positionInput.addEventListener('input', () => {
            const pos = Number.parseFloat(positionInput.value);
            if(0 <= pos && pos <= 1) {
                this.#position = pos;
                this.#performUpdate();
            }
        });
        row.insertCell().append(positionInput);

        const colorInput = document.createElement('input');
        colorInput.id  ='color';
        colorInput.type = 'color';
        colorInput.value = color;
        colorInput.addEventListener('input', () => {
            this.#color = colorInput.value;
            this.#performUpdate();
        });
        row.insertCell().append(colorInput);

        const deleteButton = document.createElement('button');
        deleteButton.innerText = 'x';
        deleteButton.addEventListener('click', () => {
            this.onClickDelete?.();
        });
        const addButton = document.createElement('button');
        addButton.innerText = '+';
        addButton.addEventListener('click', () => {
            this.onClickInsert?.();
        });
        row.insertCell().append(deleteButton, addButton);

        this.#position = position;
        this.#color = color;
        this.rowElement = row;
    }

    #performUpdate() {
        this.onUpdate?.(this.#position, this.#color);
    }

    cloneRawData() {
        return {position: this.#position, color: this.#color};
    }
}

class ColorPointList {
    /** @type {{position: number, color: string}[]} */
    #list;

    /** @type {HTMLTableSectionElement} @readonly */
    #tbodyElement;

    /** @type {((list: readonly {position: number, color: string}[]) => void) | null} */
    onUpdate = null;

    /**
     * @param {HTMLTableElement} table
     */
    constructor(table) {
        this.#list = [];
        this.#tbodyElement = table.createTBody();
    }

    /** @returns {readonly {position: number, color: string}[]} */
    getList() {
        return this.#list;
    }

    performUpdate() {
        this.onUpdate?.(this.#list);
    }

    #createAppendData() {
        const length = this.#list.length;
        if(length == 0) {
            return {position: 0, color: "#FF0000"};
        } else if(length == 1)  {
            return {position: 1, color: "#0000FF"};
        } else{
            const last = this.#list[length - 1];
            return {position: 1, color: last.color};
        }
    }

    appendPoint() {
        const {position, color} = this.#createAppendData();
        const data = {position, color};
        const row = this.#setupNewRow(data);
        this.#tbodyElement.append(row.rowElement);
        this.#list.push(data);
    }

    /**
     * @param {ColorPointEditorRow} targetRow
     */
    #insertPoint(targetRow) {
        const data = targetRow.cloneRawData();
        const row = this.#setupNewRow(data);
        targetRow.rowElement.before(row.rowElement);
        const index = this.#list.indexOf(data);
        this.#list.splice(index, 0, data);
    }

    /**
     * @param {{position: number, color: string}} data
     */
    #setupNewRow(data) {
        const row = new ColorPointEditorRow(data.position, data.color);
        row.onUpdate = (position, color) => {
            data.position = position;
            data.color = color;
            this.performUpdate();
        };
        row.onClickInsert = () => {
            this.#insertPoint(row);
        };
        row.onClickDelete = () => {
            row.rowElement.remove();
            const index = this.#list.indexOf(data);
            this.#list.splice(index, 1);
            this.performUpdate();
        };
        return row;
    }
}

window.addEventListener('DOMContentLoaded', () => {
    const messagePanel = requireElement(document, 'messagePanel', HTMLElement);
    messagePanel.innerText = '';

    const inputTable = requireElement(document, 'inputTable', HTMLTableElement);
    const appendButton = requireElement(document, 'appendButton', HTMLButtonElement);
    const widthInput = requireElement(document, 'widthInput', HTMLInputElement);
    const heightInput = requireElement(document, 'heightInput', HTMLInputElement);
    const presetSizeSelector = requireElement(document, 'presetSizeSelector', HTMLSelectElement);
    const angleInput = requireElement(document, 'angleInput', HTMLInputElement);

    const exportButton = requireElement(document, 'exportButton', HTMLButtonElement);
    const previewCanvas = requireElement(document, 'previewCanvas', HTMLCanvasElement);
    const ctx = previewCanvas.getContext('2d');
    if(!ctx) throw new Error('failed to get Context2D from the canvas');

    /** 
     * @param {CanvasRenderingContext2D} ctx
     * @param {number} width
     * @param {number} height
     * @param {readonly {position: number, color: string}[]} list
     * @param {number} angle
     */
    const render = (ctx, width, height, list, angle) => {
        const cx = width / 2;
        const cy = height / 2;
        const s = Math.sin(angle * Math.PI / 180);
        const c = Math.cos(angle * Math.PI / 180);
        const halfLength = Math.max(Math.abs(cx * c - cy * s), Math.abs(cx * c + cy * s));
        const grad = ctx.createLinearGradient(cx - halfLength * c, cy - halfLength * s, cx + halfLength * c, cy + halfLength * s);
        for(const c of list) {
            grad.addColorStop(c.position, c.color);
        }
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
    };

    const dataList = new ColorPointList(inputTable);
    
    dataList.appendPoint();
    dataList.appendPoint();

    dataList.onUpdate = (list) => {
        const imageWidth = widthInput.valueAsNumber;
        const imageHeight = heightInput.valueAsNumber;
        const gradationAngle = angleInput.valueAsNumber;
        const maxSize = 200;
        const ratio = Math.min(maxSize / imageWidth, maxSize / imageHeight);
        const previewWidth = imageWidth * ratio;
        const previewHeight = imageHeight * ratio;
        previewCanvas.width = previewWidth;
        previewCanvas.height = previewHeight;
        render(ctx, previewWidth, previewHeight, list, gradationAngle);
    };
    appendButton.addEventListener('click', () => {
        dataList.appendPoint();
    });

    widthInput.valueAsNumber = window.screen.width;
    widthInput.addEventListener('input', () => {
        dataList.performUpdate();
        presetSizeSelector.value = '';
    });
    heightInput.valueAsNumber = window.screen.height;
    heightInput.addEventListener('input', () => {
        dataList.performUpdate();
        presetSizeSelector.value = '';
    });
    presetSizeSelector.addEventListener('input', () => {
        const value = presetSizeSelector.value;
        const m = value.match(/^([0-9]+)x([0-9]+)$/);
        if(m) {
            widthInput.value = m[1];
            heightInput.value = m[2];
            dataList.performUpdate();
        }
    });
    angleInput.valueAsNumber = 90;
    angleInput.addEventListener('input', () => {
        dataList.performUpdate();
    });

    messagePanel.innerText = 'Done';
    dataList.performUpdate();

    const dummyAnchor = document.createElement('a');

    const exportCanvas = document.createElement('canvas');
    const exportContext = exportCanvas.getContext('2d');
    if(!exportContext) throw new Error('failed to get Context2D from the canvas');
    exportButton.addEventListener('click', () => {
        const imageWidth = widthInput.valueAsNumber;
        const imageHeight = heightInput.valueAsNumber;
        const gradationAngle = angleInput.valueAsNumber;
        exportCanvas.width = imageWidth;
        exportCanvas.height = imageHeight;
        render(exportContext, imageWidth, imageHeight, dataList.getList(), gradationAngle);
        const url = exportCanvas.toDataURL('image/png');
        dummyAnchor.href = url;
        dummyAnchor.download = 'gradation.png';
        dummyAnchor.click();
    });
});

