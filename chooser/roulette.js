/**
 * @param {array} arr
 */
export function shuffle(arr){
    for(let i = arr.length - 1; i > 0; i--){
        let j = Math.floor(Math.random() * (i+1));
        let tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
    }
}

/**
 * @param {array} arr
 * @param {number} count
 */
function repeatArray(arr, count){
    let result = [];
    for(let i = count; i > 0; i--){
        result = result.concat(arr);
    }
    return result;
}

/**
 * @param {string} path
 * @param {string} method
 */
export function loadJSON(path, method='GET'){
    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        request.open(method, path, true);
        request.responseType = 'json';
        request.onload = _ev => {
            if(request.status === 200){
                resolve(request.response);
            }else{
                reject(new Error(request.statusText));
            }
        };
        request.onerror = () => {
            reject(new Error(request.statusText));
        };
        request.send();
    });
}

/**
 * @param {number} radius
 * @param {number} width
 * @param {string[]} data
 * @param {string[]} colors
 */
function createRouletteDisk(radius, width, data, colors){
    if(radius < width) throw new Error(`radius(${radius}) < width(${width})`);
    const canvas = document.createElement('canvas');
    canvas.width = radius * 2;
    canvas.height = radius * 2;
    const g = canvas.getContext('2d');

    g.translate(radius, radius);

    const count = data.length;
    const unitAngle = 2 * Math.PI / count;

    const innerRadius = radius - width;
    const outerY = radius * Math.sin(unitAngle * 0.5);
    const font = Math.ceil(Math.min(outerY, radius / 10)) + "px sans-serif";

    g.textBaseline = "middle";
    console.log("old font: " + g.font);
    console.log("new font: " + font);
    g.font = font;
    for(let i = 0; i < count; i++){
        g.beginPath();
        g.arc(0, 0, radius, Math.PI + unitAngle*0.5, Math.PI - unitAngle*0.5, true);
        g.arc(0, 0, innerRadius, Math.PI - unitAngle*0.5, Math.PI + unitAngle*0.5, false);
        g.closePath();
        g.fillStyle = colors[i % colors.length];
        g.fill();
        g.fillStyle = "black";
        g.fillText(data[i], -radius, 0, width);

        g.rotate(-unitAngle);
    }

    return canvas;
}

/**
 * @param {number} radius
 */
function createAcceleratorDisk(radius, diskWidth){
    const canvas = document.createElement('canvas');
    canvas.width = radius * 2;
    canvas.height = radius * 2;
    const g = canvas.getContext('2d');

    const count = 32;
    const unitAngle = 2 * Math.PI / count;

    const innerRadius = radius - diskWidth;

    const colors = ['#FFF', '#AAA', '#555', '#000'];

    for(let i = 0; i < count; i++){
        const startAngle = unitAngle * i;
        const endAngle = unitAngle * (i + 1);
        g.beginPath();
        g.arc(radius, radius, radius, endAngle, startAngle, true);
        g.arc(radius, radius, innerRadius, startAngle, endAngle, false);
        g.closePath();
        g.fillStyle = colors[i % 4];
        g.fill();
    }

    return canvas;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {HTMLElement} resultView
 */
export function renderer(canvas, resultView){
    const width = canvas.width;
    const height = canvas.height;

    const sideMargin = Math.min(width * 0.05, 50);
    const indicatorWidth = sideMargin * 0.8;
    const indicatorHeight = indicatorWidth * 0.5;
    const diskWidth = width * 0.9 - sideMargin * 2;
    const radius = diskWidth * 2;
    const cx = width - sideMargin * 2 + radius - diskWidth;
    const cy = height / 2;

    const innerRadius = radius - diskWidth;
    const acceleratorDisk = createAcceleratorDisk(innerRadius, sideMargin * 0.5);

    /** @type {string[]?} */
    let names = null;
    /** @type {HTMLCanvasElement?} */
    let rouletteDisk = null;

    /**
     * @param {string[]} data
     */
    const setData = (data) => {
        const repeatCount = Math.ceil(32 / data.length);
        if(repeatCount > 1){
            data = repeatArray(data, repeatCount);
        }
        names = data;
        let colors;
        if(data.length % 3 == 0){
            colors = ['#ffdfaf', '#afcfff', '#ffcfff'];
        }else{
            if(data.length % 2 == 1) names.push("");
            colors = ['#ffdfaf', '#afcfff'];
        }
        rouletteDisk = createRouletteDisk(radius, diskWidth, data, colors);
        update(0, false);
    };

    let fixListener = null;

    const setFixListener = (listener) =>{
        fixListener = listener;
    };

    const g = canvas.getContext('2d');

    // 単位は rad / s
    const poweredRotateSpeed = Math.PI;
    const poweredMinimumSpeed = poweredRotateSpeed * 0.5;
    const accelDuration = 1;
    const wheelingDuration = 4;
    const deceleration = poweredRotateSpeed / wheelingDuration;

    let angle = 0;
    let rotateSpeed = 0;
    let currentIndex = 0;
    let accAngle = 0;

    let stopReportRequested = false;

    /**
     * @param {number} delta フレーム秒
     * @param {boolean} pressed
     * @returns {boolean} 継続するかどうか
     */
    const update = (delta, pressed) => {
        if(!isFinite(delta)) throw new Error('delta = ' + delta)

        if(names === null){
            g.save();

            g.fillStyle = "#007f00";
            g.fillRect(0, 0, width, height);
            g.strokeStyle = "red";
            g.beginPath();
            g.arc(cx, cy, radius, 0, 2 * Math.PI, false);
            g.arc(cx, cy, innerRadius, 0, 2 * Math.PI, true);
            g.stroke();
            g.fillStyle = "#cfcfff";
            g.fill();

            g.restore();
            return false;
        }

        angle += rotateSpeed * delta;
        if(pressed){
            if(rotateSpeed < poweredMinimumSpeed) rotateSpeed = poweredMinimumSpeed;
            rotateSpeed += (poweredRotateSpeed - rotateSpeed) / accelDuration * delta;
            stopReportRequested = true;

            accAngle += poweredRotateSpeed * delta;
        }else if(rotateSpeed != 0){
            rotateSpeed -= deceleration * delta;
            if(rotateSpeed <= 0){
                rotateSpeed = 0;
            }
        }
        const indicating = Math.round(angle * 0.5 / Math.PI * names.length) % names.length;
        if(indicating != currentIndex){
            currentIndex = indicating;
            const currentName = names[indicating];
            resultView.innerText = currentName === '' ? '該当なし' : currentName;
        }
        if(stopReportRequested && rotateSpeed == 0){
            stopReportRequested = false;
            if(fixListener){
                const currentName = names[indicating];
                if(currentName){
                    fixListener(currentName);
                }else{
                    fixListener(null);
                }
            }
        }

        g.save();

        g.fillStyle = "#007f00";
        g.fillRect(0, 0, width, height);
        g.translate(cx, cy);
        g.rotate(angle);
        g.drawImage(rouletteDisk, -radius, -radius);

        g.restore();

        g.save();

        g.translate(cx, cy);
        g.rotate(accAngle);
        g.drawImage(acceleratorDisk, -innerRadius, -innerRadius);

        g.restore();

        g.save();

        g.strokeStyle = "white";
        g.fillStyle = "#FF007F";
        g.translate(cx - radius, cy);
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(-indicatorWidth, -indicatorHeight);
        g.lineTo(-indicatorWidth, indicatorHeight);
        g.closePath();
        g.fill();
        g.stroke();

        g.restore();

        return rotateSpeed != 0;
    };

    return {
        update,
        setData,
        setFixListener,
    };
}