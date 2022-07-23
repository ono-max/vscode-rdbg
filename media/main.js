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
                <rect x="32%" y="32%" width="6" height="6" />
            </svg>
        `,
    expanded: `
            <svg version="1.1" width="12" xmlns="http://www.w3.org/2000/svg">
                <path d="M 1 5 L 6 9" />
                <path d="M 6 9 L 11 5" />
            </svg>
    `,
    collapsed: `
            <svg version="1.1" width="12" height="14" xmlns="http://www.w3.org/2000/svg">
                <path d="M 4 2 L 8 7" />
                <path d="M 8 7 L 4 12" />
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
    if (nextButton === null || prevButton === null || recordButton === null || goBackToButton === null || goToButton === null) {
        return
    }

    nextButton.addEventListener('click', goToNextPage, false)
    prevButton.addEventListener('click', goToPrevPage, false)
    recordButton.addEventListener('click', startRecord, false)
    goBackToButton.addEventListener('click', goBackToOnce, false)
    goToButton.addEventListener('click', goToOnce, false)

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
        renderer.activate(targetRec);
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
        rerender();
    }

    function goToPrevPage() {
        if (curPage < 2) {
            return;
        }
        curPage -= 1
        rerender();
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
    const rbenvRegexp = /\.rbenv\/versions\/\d\.\d\.\d\/lib\//
    const gemRegexp = /ruby\/gems\/\d.\d.\d\/gems\//


    function rerender() {
        const end = curRecords.length - (maxPage - curPage) * pageSize;
        let start = end - pageSize;
        if (start < 0) {
            start = 0;
        }
        renderer.activate(curRecords.slice(start, end))
        disablePageButtons();
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
        if (recordButton.classList.contains('disabled')) {
            return
        }
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
        if (recordButton.classList.contains('disabled')) {
            return
        }
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

    class FrameNameFilter {
        constructor(records) {

        }

        
    }

    class recordRenderer {
        constructor(records) {
            this.curAllRec = records;
            this.frameContainer = document.querySelector('#frames');
            const lastRecord = records[records.length - 1];
            this.currentStoppedCursor = lastRecord.begin_cursor + lastRecord.locations.length;
        }

        activate(targetRec) {
            this._resetView();
            
            const minDepth = this._findMinDepth(targetRec);
            targetRec.forEach((record) => {
                const div = document.createElement('div');
                div.classList.add('frame');
                div.setAttribute('data-index', record.index);
                const collapsible = document.createElement('div');
                collapsible.classList.add('collapsible');
                collapsible.innerHTML = SVG_ICONS.collapsed;
                div.appendChild(collapsible);
                const depth = record.frame_depth - minDepth
                div.style.paddingLeft = `${depth}em`;
                div.setAttribute('data-depth', depth.toString())
                const name = document.createTextNode(record.name);
                div.appendChild(name);
                const args = this._getArgs(record.args);
                div.appendChild(args);
                this. _addShowLocationsListener(div);
                // @ts-ignore
                this.frameContainer.appendChild(div);
                record.locations.forEach((loc) => {
                    if (loc.current) {
                        div.click()
                    }
                })
            })
        }

        _addShowLocationsListener(element) {
            const self = this;
            element.addEventListener('click', function() {
                const result = this.classList.toggle('locationShowed');
                const collapsible = this.querySelector('.collapsible');
                if (!result) {
                    collapsible.innerHTML = SVG_ICONS.collapsed;
                    this.nextElementSibling.remove();
                    return;
                }
                collapsible.innerHTML = SVG_ICONS.expanded
                const recordIdx = this.dataset.index;
                const record = self.curAllRec[recordIdx];
                let cursor = record.begin_cursor;
                const parent = document.createElement('div')
                const depth = parseInt(this.dataset.depth) + 2
                record.locations.forEach((loc) => {
                    const div = document.createElement('div');
                    div.classList.add('location');
                    div.setAttribute('data-cursor', cursor);
                    let name = loc.name.replace(rbenvRegexp, '');
                    name = name.replace(gemRegexp, '');
                    div.style.paddingLeft = `${depth}em`;
                    self._createTableData(name, div);
                    self._addStepListener(div)
                    if (loc.current) {
                        div.classList.add('stopped');
                        self.currentStoppedCursor = cursor;
                    }
                    parent.appendChild(div);
                    cursor += 1;
                })
                this.insertAdjacentElement('afterend', parent)
            })
        }

        _findMinDepth(records) {
            let min = records[0].frame_depth
            for (let i = 1; i < records.length; i++) {
                const depth = records[i].frame_depth
                if (min > depth) {
                    min = depth;
                }
            }
            return min
        }

        _getArgs(args) {
            const span = document.createElement('span');
            span.classList.add('args')
            if (args === null) return span
            let data = ""
            args.forEach((arg) => {
                data += `${space}${arg.name}=${arg.value}`
            })
            const text = document.createTextNode(data);
            span.appendChild(text);
            return span
        }

        _resetView() {
            // @ts-ignore
            this.frameContainer.innerHTML = '';
        }

        _createTableData(data, parent) {
            const text = document.createTextNode(data);
            parent.appendChild(text);
        }

        _addStepListener(element) {
            const self = this;
            element.addEventListener('click', function() {
                if (this.classList.contains('stopped') || eventTriggered) {
                    return;
                }

                eventTriggered = true;
        
                let times = self.currentStoppedCursor - parseInt(this.dataset.cursor);
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
            })
        }
    }

    let renderer;

    window.addEventListener('message', event => {
        const data = event.data;
        switch (data.command) {
            case 'update':
                eventTriggered = false;
                const records = data.records;
                const logIndex = data.logIndex;
                curPage = 1;
                renderer = new recordRenderer(records)
                update(records, logIndex);
                break;
        };
    });

    vscode.postMessage({
        command: 'viewLoaded'
    })
}());
