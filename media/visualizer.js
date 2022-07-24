// @ts-check

(function () {
    // @ts-ignore
    const vscode = acquireVsCodeApi();

    const container = document.querySelector('#container');

    function update(object) {
        const table = document.createElement('table');
        const keys = Object.keys(object[0])
        const headers = document.createElement('tr');
        keys.forEach((key) => {
            const th = document.createElement('th');
            const text = document.createTextNode(key)
            th.appendChild(text);
            headers.appendChild(th);
        })

        table.appendChild(headers)

        object.forEach((v) => {
            const tr = document.createElement('tr');
            Object.values(v).forEach((value) => {
                const td = document.createElement('td');
                const text = document.createTextNode(value)
                td.appendChild(text);
                tr.appendChild(td);
            })
            table.appendChild(tr);
        })
        container?.appendChild(table)
    };

    window.addEventListener('message', event => {
        const data = event.data;
        switch (data.command) {
            case 'update':
                update(data.object);
                break;
        };
    });

    // vscode.postMessage({
    //     command: 'viewLoaded'
    // })
}());
