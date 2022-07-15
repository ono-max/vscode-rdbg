// @ts-check

const SVG_ICONS = {
    goTo: `
            <svg version="1.1" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
               <path d="M 0 2 L 8 8 L 0 14 Z" />
               <path d="M 8 2 L 16 8 L 8 14 Z" />
            </svg>
        `,
    goBackTo: `
            <svg version="1.1" width="16" height="16" xmlns="http://www.w3.org/2000/svg">
                <path d="M 16 14 L 8 8 L 16 2 Z" />
                <path d="M 8 14 L 0 8 L 8 2 Z" />
            </svg>
        `,
    startRecord: `
            <svg version="1.1" width="16" height="16" xmlns="http://www.w3.org/2000/svg" class="start">
                <circle cx="50%" cy="50%" r="7.5" fill="transparent" />
                <circle cx="50%" cy="50%" r="4" fill="transparent" />
            </svg>
        `,
    stopRecord: `
            <svg version="1.1" width="16" height="16" xmlns="http://www.w3.org/2000/svg" class="stop">
                <circle cx="50%" cy="50%" r="7.5" fill="transparent" />
                <rect x="32%" y="32%" width="6" height="6" fill="red" />
            </svg>
    `
};

(function () {
    // @ts-ignore
    const vscode = acquireVsCodeApi();

    let curRecords = [];
    let logIndex = 0;
    let eventTriggered;
    let maxPage;

    const pageSize = 50;
    let curPage = 1;

    const actionsElement = document.querySelector('#actions');
    if (actionsElement !== null) {
        const ul = document.createElement('ul');
        ul.classList.add('debugButtons')
        // TODO: Do not insert startRecord because it's not always.
        appendListElement(ul, SVG_ICONS.startRecord, 'recordButton');
        appendListElement(ul, SVG_ICONS.goBackTo, 'goBackToButton');
        appendListElement(ul, SVG_ICONS.goTo, 'goToButton');
        actionsElement.appendChild(ul)
    }

    function appendListElement(parent, text, className) {
        const li = document.createElement('li');
        li.innerHTML = text;
        li.classList.add(className);
        parent.appendChild(li)
    }

    const nextButton = document.querySelector('#nextButton')
    const prevButton = document.querySelector('#prevButton')
    const goBackToButton = document.querySelector('.goBackToButton')
    const goToButton = document.querySelector('.goToButton')
    const recordButton = document.querySelector('.recordButton')
    const dropDownBtn = document.querySelector('#dropdownBtn');
    if (nextButton === null || prevButton === null || recordButton === null || goBackToButton === null || goToButton === null) {
        return
    }

    nextButton.addEventListener('click', goToNextPage, false)
    prevButton.addEventListener('click', goToPrevPage, false)
    recordButton.addEventListener('click', startRecord, false)
    goBackToButton.addEventListener('click', goBackToOnce, false)
    goToButton.addEventListener('click', goToOnce, false)
    dropDownBtn.addEventListener('click', dropDownMenu, false)

    disableControlButtons();

    function update(records, logIdx) {
        if (recordButton === null) {
            return;
        }
        recordButton.innerHTML = SVG_ICONS.stopRecord;
        curRecords = records;
        logIndex = logIdx;
        maxPage = Math.ceil(curRecords.length / pageSize);
        const targetRec = findTargetRecords()
        const index = curRecords.findIndex(rec => Object.is(rec, targetRec[0]));
        renderPage(targetRec, index);
        disablePageButtons();
        enableAvailCmdButtons();
    };

    function findTargetRecords() {
        const lastRec = curRecords[curRecords.length - 1];
        curPage = maxPage;
        if (logIndex > lastRec.begin_cursor + lastRec.locations.length) {
            return curRecords.slice(-pageSize)
        }
        let remainRec = curRecords
        while (remainRec.length > 1) {
            const records = remainRec.slice(-pageSize)
            const firstRec = records[0];
            const lastRec = records[records.length - 1];
            const start = firstRec.begin_cursor;
            const end = lastRec.begin_cursor + lastRec.locations.length;
            if (logIndex >= start && logIndex <= end) {
                return records
            }

            curPage -= 1
            remainRec = curRecords.slice(0, -pageSize)
        }
        return remainRec
    }

    function goToNextPage() {
        if (curPage === maxPage) {
            return;
        }
        curPage += 1;
        const end = curRecords.length - (maxPage - curPage) * pageSize;
        const start = end - pageSize;
        renderPage(curRecords.slice(start, end), start)
        disablePageButtons();
    }

    function goToPrevPage() {
        if (curPage < 2) {
            return;
        }
        curPage -= 1
        const end = curRecords.length - (maxPage - curPage) * pageSize;
        let start = end - pageSize;
        if (start < 0) {
            start = 0;
        }
        renderPage(curRecords.slice(start, end), start)
        disablePageButtons();
    }

    let frameMap = new Map();

    function createFrameMap() {
        curRecords.forEach((record) => {
            // TODO: index(timestamp的な)を用意して最後にsort
            const splits = record.name.split(/#|\./);
            const key = splits[0]
            if (frameMap.has(key)) {
                frameMap.get(key).push(record)
            } else {
                frameMap.set(key, [record])
            }
        })
    }
    
    function dropDownMenu() {
        const menu = document.createElement('div');
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Class Name';
        // input.addEventListener('keyup', filterClass, false);

        menu.appendChild(input);
        const ul = document.createElement('ul');
        ul.classList.add('frameNames');
        createFrameMap();
        for (let name of frameMap.keys()) {
            const li = document.createElement('li');
            li.innerHTML = name;
            li.setAttribute('data-frame-key', name)
            li.addEventListener('click', filterFrames, false)
            ul.appendChild(li)
        }
        menu.appendChild(ul);
        this.insertAdjacentElement('afterend', menu);
    }

    function filterFrames() {
        console.log(this.dataset.frameKey);
    }

    // TODO: enableAvailCmdと同じような感じにする
    function disablePageButtons() {
        prevButton.disabled = false;
        nextButton.disabled = false;
        if (curPage === maxPage) {
            nextButton.disabled = true;
        }
        if (curPage === 1) {
            prevButton.disabled = true;
        }
    }

    function startRecord() {
        if (this.querySelector('.start') !== null) {
            this.innerHTML = SVG_ICONS.stopRecord;
            vscode.postMessage({
                command: 'startRecord'
            })
        } else {
            this.innerHTML = SVG_ICONS.startRecord;
            vscode.postMessage({
                command: 'stopRecord'
            })
        }
    }

    function goBackToOnce() {
        if (logIndex === 0) {
            return
        }
        disableControlButtons();
        recordButton.classList.add('disabled');
        vscode.postMessage({
            command: 'goBackTo',
            times: 1
        })
    }

    function goToOnce() {
        const lastRec = curRecords[curRecords.length - 1]
        if (lastRec.begin_cursor + lastRec.locations.length <= logIndex) {
            return
        }
        disableControlButtons();
        recordButton.classList.add('disabled');
        vscode.postMessage({
            command: 'goTo',
            times: 1
        })
    }

    function enableAvailCmdButtons() {
        if (recordButton === null || goBackToButton === null || goToButton === null) {
            return;
        }
        recordButton.classList.remove('disabled');
        if (logIndex !== 0) {
            goBackToButton.classList.remove('disabled');
        }
        const lastRec = curRecords[curRecords.length - 1]
        if (lastRec.begin_cursor + lastRec.locations.length > logIndex) {
            goToButton.classList.remove('disabled');
        }
    }

    function disableControlButtons() {
        goBackToButton.classList.add('disabled');
        goToButton.classList.add('disabled');
    }

    const space = "\xA0"

    function renderPage(records, id) {
        resetView();
        const tbody = document.querySelector('#frames');
        let recordIndex = id;
        let clickable = true;
        const minDepth = findMinDepth(records);
        records.forEach((record) => {
            const div = document.createElement('div');
            div.classList.add('frame');
            div.setAttribute('data-index', recordIndex.toString());
            const frameInfo = document.createElement('div');
            const indent = space.repeat(record.frame_depth - minDepth);
            const name = document.createTextNode(`${indent}${record.name}`);
            frameInfo.appendChild(name);
            const args = getArgs(record.args);
            frameInfo.appendChild(args);
            div.appendChild(frameInfo);
            div.addEventListener('click', showLocations, false);
            tbody.appendChild(div);
            if (clickable && record.begin_cursor + record.locations.length > logIndex) {
                div.click();
                clickable = false;
            }
            recordIndex += 1;
        })
    }

    function getArgs(args) {
        let data = ""
        args.forEach((arg) => {
            data += `${space}${arg.name}=${arg.value}`
        })
        const text = document.createTextNode(data);
        const span = document.createElement('span');
        span.classList.add('args')
        span.appendChild(text);
        return span
    }

    function findMinDepth(records) {
        let min = records[0].frame_depth
        for (let i = 1; i < records.length; i++) {
            const depth = records[i].frame_depth
            if (min > depth) {
                min = depth;
            }
        }
        return min
    }
 
    let currentStoppedCursor = null;

    function showLocations() {
        const result = this.classList.toggle('locationShowed');
        if (!result) {
            this.nextElementSibling.remove();
            return;
        }
        const recordIdx = this.dataset.index;
        const record = curRecords[recordIdx];
        let cursor = record.begin_cursor;
        const parent = document.createElement('div')
        record.locations.forEach((loc) => {
            const div = document.createElement('div');
            div.classList.add('location');
            div.setAttribute('data-cursor', cursor);
            createTableData(loc, div);
            div.addEventListener('click', goHere, false);
            if (cursor === logIndex) {
                div.classList.add('stopped');
                currentStoppedCursor = cursor;
            }
            parent.appendChild(div);
            cursor += 1;
        })
        this.insertAdjacentElement('afterend', parent)
    }


    function goHere() {
        if (this.classList.contains('stopped') || eventTriggered) {
            return;
        }
        eventTriggered = true;

        const lastRecord = curRecords[curRecords.length - 1];
        const currentIndex = currentStoppedCursor || lastRecord.begin_cursor + lastRecord.locations.length;

        let times = currentIndex - parseInt(this.dataset.cursor);
        var command;
        if (times > 0) {
            command = 'goBackTo';
        } else {
            command = 'goTo';
            times = Math.abs(times);
        }
        vscode.postMessage({
            command: command,
            times: times
        })
    }

    function resetView() {
        const frames = document.querySelector('#frames');
        frames.innerHTML = '';
    }

    function createTableData(data, parent) {
        const div = document.createElement('div');
        const text = document.createTextNode(data);
        div.appendChild(text);
        parent.appendChild(div);
    }

    window.addEventListener('message', event => {
        const data = event.data;
        switch (data.command) {
            case 'update':
                eventTriggered = false;
                const records = data.records;
                const logIndex = data.logIndex;
                curPage = 1;
                update(records, logIndex);
                break;
        };
    });

    document.addEventListener('keydown', bindShortcut, false)

    function bindShortcut(e) {
        // TODO: こんな感じでreturn
        // if (e.target.querySelector('.form')) {
        //     return
        // }
        switch (e.key) {
            case 'ArrowDown':
                goBackToOnce();
                break;
            case 'ArrowUp':
                goToOnce();
                break;
            case 'ArrowRight':
                goToOnce();
                break;
            case 'ArrowLeft':
                goBackToOnce();
                break;
        }
    }

    vscode.postMessage({
        command: 'viewLoaded'
    })
}());
