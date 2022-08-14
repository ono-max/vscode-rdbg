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

    let eventTriggered;

    const pageSize = 50;

    const space = "\xA0"
    const rbenvRegexp = /\.rbenv\/versions\/\d\.\d\.\d\/lib\//
    const gemRegexp = /ruby\/gems\/\d.\d.\d\/gems\//

    class EventFactory {
        /**
         * @type {EventFactory}
         */
        static historyView;

        static async activate() {
            if (EventFactory.historyView) {
                EventFactory.historyView.update();
                return
            }
            EventFactory.historyView = new EventFactory
            EventFactory.historyView.update();
        }

        curPage = 1;
        maxPage = 1;

        /**
         * @param {any} [records]
         * @param {any} [logIdx]
         * @param {recordRenderer} [recRenderer]
         * @param {HistoryViewRenderer} [viewRenderer]
         */
        constructor(records, logIdx, recRenderer, viewRenderer) {
            if (viewRenderer === undefined || recRenderer === undefined) {
                return;
            }
            this.curAllRecs = records;
            this.logIndex = logIdx;
            /**
             * @type {recordRenderer}
             */
            this.recRenderer = recRenderer;
            /**
             * @type {HistoryViewRenderer}
             */
            this.viewRendrer = viewRenderer;
            this._addRecordListener();
            this._addStepBackListener();
            this._addStepInListener();
            this._addPrevPageListener();
            this._addNextPageListener();
            this._addFilterListener();
        }

        _addRecordListener() {
            this.viewRendrer.recordButton.addEventListener('click', function() {
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
            })
        }

        _addStepBackListener() {
            const goBackToBtn = document.createElement('li');
            goBackToBtn.innerHTML = SVG_ICONS.goBackTo;
            goBackToBtn.className = 'goBackToButton';
            const self = this;
            this.viewRendrer.goBackToButton.addEventListener('click', function() {
                if (self.viewRendrer.recordButton.classList.contains('disabled')) {
                    return
                }
                const lastRec = self.curAllRecs[self.curAllRecs.length - 1]
                if (lastRec.begin_cursor + lastRec.locations.length <= self.logIndex) {
                    return
                }
                self.viewRendrer.disableControlButtons();
                self.viewRendrer.recordButton.classList.add('disabled');
                vscode.postMessage({
                    command: 'goTo',
                    times: 1
                })
            })
            return goBackToBtn
        }

        _addStepInListener() {
            const goToBtn = document.createElement('li');
            goToBtn.innerHTML = SVG_ICONS.goTo;
            goToBtn.className = 'goToButton';
            const self = this;
            goToBtn.addEventListener('click', function() {
                if (self.viewRendrer.recordButton.classList.contains('disabled')) {
                    return
                }
                const lastRec = self.curAllRecs[self.curAllRecs.length - 1]
                if (lastRec.begin_cursor + lastRec.locations.length <= self.logIndex) {
                    return
                }
                self.viewRendrer.disableControlButtons();
                self.viewRendrer.recordButton.classList.add('disabled');
                vscode.postMessage({
                    command: 'goTo',
                    times: 1
                })
            })
            return goToBtn;
        }

        _addPrevPageListener() {
            const prevBtn = document.createElement('button');
            const self = this;
            prevBtn.addEventListener('click', function() {
                if (self.curPage < 2) {
                    return;
                }
                self.curPage -= 1
                const end = self.curAllRecs.length - (self.maxPage - self.curPage) * pageSize;
                let start = end - pageSize;
                if (start < 0) {
                    start = 0;
                }
                self.recRenderer.activate(self.curAllRecs.slice(start, end))
                // TODO: enableAvailCmdと同じような感じにする
                self.viewRendrer.prevPageButton.disabled = false;
                self.viewRendrer.nextPageButton.disabled = false;
                if (self.curPage === self.maxPage) {
                    self.viewRendrer.prevPageButton.disabled = true;
                }
                if (self.curPage === 1) {
                    self.viewRendrer.prevPageButton.disabled = true;
                }
            })
            return prevBtn;
        }

        _addNextPageListener() {
            const nextBtn = document.createElement('button');
            const self = this;
            nextBtn.addEventListener('click', function() {
                if (self.curPage === self.maxPage) {
                    return;
                }
                self.curPage += 1;
                const end = self.curAllRecs.length - (self.maxPage - self.curPage) * pageSize;
                let start = end - pageSize;
                if (start < 0) {
                    start = 0;
                }
                self.recRenderer.activate(self.curAllRecs.slice(start, end))
                self.viewRendrer.prevPageButton.disabled = false;
                self.viewRendrer.prevPageButton.disabled = false;
                if (self.curPage === self.maxPage) {
                    self.viewRendrer.prevPageButton.disabled = true;
                }
                if (self.curPage === 1) {
                    self.viewRendrer.prevPageButton.disabled = true;
                }
            })
            return nextBtn;
        }

        _addFilterListener() {
            const input = document.createElement('input');
            input.addEventListener('input', (e) => {
                if (!(e.target instanceof HTMLInputElement)) return;

                let records = []
                if (e.target.value === '') {
                    records = this._findTargetRecords();
                } else {
                    for (let i = 0; i < this.curAllRecs.length; i++) {
                        if (this.curAllRecs[i].name.toLowerCase().indexOf(e.target.value.toLowerCase()) === -1) continue
    
                        records.push(this.curAllRecs[i])
                    }
                }
                this.recRenderer.activate(records);
            })
            return input;
        }

        async update(records, logIdx) {
            this.curAllRecs = records;
            this.logIndex = logIdx;
            this.viewRendrer.recordButton.innerHTML = SVG_ICONS.stopRecord;
            this.maxPage = Math.ceil(this.curAllRecs.length / pageSize);
            const targetRec = this._findTargetRecords()
            this.recRenderer.activate(targetRec);
            this.viewRendrer.prevPageButton.style.display = 'block';
            this.viewRendrer.nextPageButton.style.display = 'block';
            this.viewRendrer.prevPageButton.disabled = false;
            this.viewRendrer.nextPageButton.disabled = false;
            if (this.curPage === this.maxPage) {
                this.viewRendrer.nextPageButton.disabled = true;
            }
            if (this.curPage === 1) {
                this.viewRendrer.prevPageButton.disabled = true;
            }
            this._enableAvailCmdButtons();
        };

        _enableAvailCmdButtons() {
            this.viewRendrer.recordButton.classList.remove('disabled');
            if (this.logIndex !== 0) {
                this.viewRendrer.goBackToButton.classList.remove('disabled');
            }
            const lastRec = this.curAllRecs[this.curAllRecs.length - 1]
            if (lastRec.begin_cursor + lastRec.locations.length > this.logIndex) {
                this.viewRendrer.goToButton.classList.remove('disabled');
            }
        }

        _findTargetRecords() {
            const lastRec = this.curAllRecs[this.curAllRecs.length - 1];
            this.curPage = this.maxPage;
            if (this.logIndex > lastRec.begin_cursor + lastRec.locations.length) {
                return this.curAllRecs.slice(-pageSize)
            }
            let remainRec = this.curAllRecs
            while (remainRec.length > 1) {
                const records = remainRec.slice(-pageSize)
                const firstRec = records[0];
                const lastRec = records[records.length - 1];
                const start = firstRec.begin_cursor;
                const end = lastRec.begin_cursor + lastRec.locations.length;
                if (this.logIndex >= start && this.logIndex <= end) {
                    return records
                }
    
                this.curPage -= 1
                remainRec = this.curAllRecs.slice(0, -pageSize)
            }
            return remainRec
        }
    }

    class HistoryViewRenderer {
        #recordBtn;
        #goBackToBtn;
        #goToBtn;
        #prevPageBtn;
        #nextPageBtn;
        #input;
        constructor() {
            this.#recordBtn = this._renderRecordButton();
            this.#goBackToBtn = this._renderStepBackButton();
            this.#goToBtn = this._renderStepInButton();
            this.#prevPageBtn = this._renderPrevPageButton();
            this.#nextPageBtn = this._renderNextPageButton();
            this.#input = this._renderFilterInput();
            this._initializeView();
        }

        get recordButton() {
            return this.#recordBtn;
        }

        get goBackToButton() {
            return this.#goBackToBtn;
        }

        get goToButton() {
            return this.#goToBtn;
        }

        get prevPageButton() {
            return this.#prevPageBtn;
        }

        get nextPageButton() {
            return this.#nextPageBtn;
        }

        get filterInput() {
            return this.#input;
        }

        disableControlButtons() {
            this.#goBackToBtn.classList.add('disabled');
            this.#goToBtn.classList.add('disabled');
        }    

        _renderRecordButton() {
            const recordBtn = document.createElement('li');
            recordBtn.innerHTML = SVG_ICONS.startRecord;
            recordBtn.className = 'recordButton';
            return recordBtn;
        }

        _renderStepInButton() {
            const goToBtn = document.createElement('li');
            goToBtn.innerHTML = SVG_ICONS.goTo;
            goToBtn.className = 'goToButton';
            return goToBtn;
        }

        _renderStepBackButton() {
            const goBackToBtn = document.createElement('li');
            goBackToBtn.innerHTML = SVG_ICONS.goBackTo;
            goBackToBtn.className = 'goBackToButton';
            return goBackToBtn;
        }

        _renderPrevPageButton() {
            const prevBtn = document.createElement('button');
            return prevBtn;
        }

        _renderNextPageButton() {
            const nextBtn = document.createElement('button');
            return nextBtn;
        }

        _renderFilterInput() {
            const input = document.createElement('input');
            input.className = 'filterInput'
            return input;
        }

        _initializeView() {
            const recordView = document.createElement('div');
            recordView.className = 'recordView';
            const ul = document.createElement('ul');
            ul.classList.add('debugButtons');
            this.#goBackToBtn.classList.add('disabled');
            this.#goToBtn.classList.add('disabled');
            ul.appendChild(this.#recordBtn);
            ul.appendChild(this.#goBackToBtn);
            ul.appendChild(this.#goToBtn);
            recordView.appendChild(ul);
            const frames = document.createElement('div');
            frames.className = 'frames';
            recordView.appendChild(frames);
            recordView.appendChild(this.#input);
            this.#prevPageBtn.style.display = 'none';
            this.#nextPageBtn.style.display = 'none';
            recordView.appendChild(this.#prevPageBtn);
            recordView.appendChild(this.#nextPageBtn);
            document.body.appendChild(recordView);
        }
    }

    class recordRenderer {
        constructor(records) {
            this.curAllRec = records;
            this.frameContainer = document.querySelector('.frames');
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

    const viewRenderer = new HistoryViewRenderer()

    window.addEventListener('message', event => {
        const data = event.data;
        switch (data.command) {
            case 'update':
                eventTriggered = false;
                new EventFactory(data.records, data.logIndex, new recordRenderer(data.records), viewRenderer)
                break;
        };
    });

    vscode.postMessage({
        command: 'viewLoaded' 
    })
}());
