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

    class DropDownMenu {
        constructor(curRecords, mixin) {
            this.recordMap = new Map;
            this.curRecords = curRecords;
            Object.assign(this, mixin)
        }
    
       #createRecordMap() {
            this.curRecords.forEach((record) => {
                const splits = record.name.split(/#|\./);
                const key = splits[0]
                if (this.recordMap.has(key)) {
                    this.recordMap.get(key).push(record)
                } else {
                    this.recordMap.set(key, [record])
                }
            })
        }
    
        show() {
            const dropDownBtn = document.querySelector('#dropdownBtn');
            if (dropDownBtn === null) return
            const menu = document.querySelector('.dropDownMenu');
            if (dropDownBtn.getAttribute('aria-expanded') === 'true') {
                dropDownBtn.setAttribute('aria-expanded', 'false')
                if (menu instanceof HTMLElement) {
                    menu.style.display = 'none';
                }
                return;
            }

            if (menu instanceof HTMLElement) {
                menu.style.display = 'block';
                dropDownBtn.setAttribute('aria-expanded', 'true')
                return;
            }

            const ul = document.createElement('ul');
            ul.className = 'dropDownMenu';
            const record = document.createElement('li');
            record.classList.add('record', 'selected');
            const text = document.createTextNode('All Frames');
            record.appendChild(text);
            record.addEventListener('click', (e) => {
                dropDownBtn.setAttribute('aria-expanded', 'false');
                ul.style.display = 'none';
                const menu = document.querySelector('.dropDownMenu');
                if (menu !== null) {
                    for (let i = 0; i < menu.children.length; i++) {
                        menu.children[i].classList.remove('selected');
                    }
                }
                if (e.target instanceof HTMLElement) {
                    e.target.classList.add('selected');
                    this.rerender(this.curRecords);
                }
            })
            ul.appendChild(record);
            const filterInput = document.createElement('li');
            filterInput.className = 'filterInput';
            const input = document.createElement('input');
            if (dropDownBtn === null) return
            dropDownBtn.setAttribute('aria-expanded', 'true');
            input.type = 'text';
            input.placeholder = 'Class Name';
            filterInput.appendChild(input);
            ul.appendChild(filterInput);
            
            this.#createRecordMap();
            for (let name of this.recordMap.keys()) {
                const li = document.createElement('li');
                li.classList.add('record');
                const text = document.createTextNode(name);
                li.appendChild(text);
                li.setAttribute('data-frame-key', name);
                li.addEventListener('click', (e) => {
                    dropDownBtn.setAttribute('aria-expanded', 'false');
                    ul.style.display = 'none';
                    const menu = document.querySelector('.dropDownMenu');
                    if (menu !== null) {
                        for (let i = 0; i < menu.children.length; i++) {
                            menu.children[i].classList.remove('selected');
                        }
                    }
                    if (e.target instanceof HTMLElement) {
                        e.target.classList.add('selected');
                        const key = e.target.dataset.frameKey;
                        const records = this.recordMap.get(key);
                        this.activate(records);
                    }
                })
                ul.appendChild(li)
            }
            dropDownBtn.insertAdjacentElement('afterend', ul);
        }

        activate(_records) {
            throw new Error('should be overridden in mixin')
        }

        rerender(_records) {
            throw new Error('should be overridden in mixin')
        }
    }

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

    function dropDownMenu() {
        const menu = new DropDownMenu(curRecords, recordRendererMixin);
        menu.show()
    }

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
        recordRendererMixin.activate(targetRec);
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
        recordRendererMixin.rerender();
    }

    function goToPrevPage() {
        if (curPage < 2) {
            return;
        }
        curPage -= 1
        recordRendererMixin.rerender();
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

    const recordRendererMixin = {
        rerender() {
            const end = curRecords.length - (maxPage - curPage) * pageSize;
            let start = end - pageSize;
            if (start < 0) {
                start = 0;
            }
            this.activate(curRecords.slice(start, end))
            disablePageButtons();
        },

        activate(records) {
            this.resetView();
            const tbody = document.querySelector('#frames');
            const minDepth = this.findMinDepth(records);
            records.forEach((record) => {
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
                const args = this.getArgs(record.args);
                div.appendChild(args);
                div.addEventListener('click', this.showLocations, false);
                tbody.appendChild(div);
                record.locations.forEach((loc) => {
                    if (loc.current) {
                        div.click()
                    }
                })
            })
        },

        showLocations() {
            const result = this.classList.toggle('locationShowed');
            const collapsible = this.querySelector('.collapsible');
            if (!result) {
                collapsible.innerHTML = SVG_ICONS.collapsed;
                this.nextElementSibling.remove();
                return;
            }
            collapsible.innerHTML = SVG_ICONS.expanded
            const recordIdx = this.dataset.index;
            const record = curRecords[recordIdx];
            let cursor = record.begin_cursor;
            const parent = document.createElement('div')
            const depth = parseInt(this.dataset.depth) + 2
            record.locations.forEach((loc) => {
                const div = document.createElement('div');
                div.classList.add('location');
                div.setAttribute('data-cursor', cursor);
                const regexp = /\.rbenv\/versions\/\d\.\d\.\d\/lib\//
                const name = loc.name.replace(regexp, '');
                div.style.paddingLeft = `${depth}em`;
                createTableData(name, div);
                div.addEventListener('click', goHere, false);
                if (loc.current) {
                    div.classList.add('stopped');
                    currentStoppedCursor = cursor;
                }
                parent.appendChild(div);
                cursor += 1;
            })
            this.insertAdjacentElement('afterend', parent)
        },

        findMinDepth(records) {
            let min = records[0].frame_depth
            for (let i = 1; i < records.length; i++) {
                const depth = records[i].frame_depth
                if (min > depth) {
                    min = depth;
                }
            }
            return min
        },

        getArgs(args) {
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
        },

        resetView() {
            const frames = document.querySelector('#frames');
            frames.innerHTML = '';
        }
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

    function createTableData(data, parent) {
        const text = document.createTextNode(data);
        parent.appendChild(text);
    }
 
    let currentStoppedCursor = null;

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
