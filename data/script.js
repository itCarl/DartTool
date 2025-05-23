var d = document;
// var gateway = `ws://${window.location.hostname}/ws`;
var gateway = `ws://192.168.178.90/ws`;
var ws;
var s = t => t/1000;
var isEmpty = str => !str?.length;
var byId = id => d.getElementById(id);
var upt = (id, val) => { if(byId(id).innerHTML.trim() != val) byId(id).innerHTML = val };
var onClick = (id, cb) => byId(id).addEventListener('click', cb);
window.addEventListener('load', onLoad);

var selectedPlayerId = null;
var selectedPlayerList = [];
var lastPlayerFetch = null;
var gameState = "unkown";

function onLoad(event)
{
    initWebSocket();
}

function initWebSocket()
{
    console.log('Trying to open a WebSocket connection...');
    ws = new WebSocket(gateway);
    ws.onopen    = onOpen;
    ws.onclose   = onClose;
    ws.onerror   = onError;
    ws.onmessage = onMessage;
}

function onOpen(event)
{
    console.log('Connection opened');
    getAllPlayers();
}

function onClose(event)
{
    console.warn('Connection closed');
    setTimeout(initWebSocket, 5000);
}

function onError(event)
{
    console.log('Connection Error');
    console.log(event);
}

function onMessage(event)
{
    let data = JSON.parse(event.data);
    // console.log(event);
    console.log('path: '+ window.location.pathname);
    if(data.players) {
        let players = data.players;
        lastPlayerFetch = players;

        if(window.location.pathname == '/data/players.html') {
            const list = byId('playersList');
            list.innerHTML = ''; // Clear existing list

            players.forEach((player, index) => {
                const article = document.createElement('article');
                article.innerHTML = `
                <ul class="list no-space border">
                    <li id=${player.id}>
                        <i class="fa-solid fa-user"></i>
                        <div class='max'>${player.name}</div>
                        <div class="player-buttons">
                            <button class="secondary remove-btn" data-ui="#confirmModal" data-id="${player.id}" data-name="${player.name}">Remove</button>
                        </div>
                    </li>
                </ul>
                `;
                list.appendChild(article);
            });

            document.querySelectorAll('.remove-btn').forEach(button => {
                button.addEventListener('click', (e) => {
                    const id = e.target.dataset.id;
                    const name = e.target.dataset.name;
                    selectedPlayerId = id;
                    byId('playerToRemoveName').textContent = name;
                });
            });
        }

        if(window.location.pathname == '/data/game.html') {
            const list = byId('addPlayersList');
            list.innerHTML = '';

            players.filter(player => !selectedPlayerList.includes(player.id)).forEach((player, index) => {
                const item = document.createElement('li');
                item.id = player.id;
                item.innerHTML = `
                    <label class="checkbox">
                        <input type="checkbox" name="selectedPlayers" value="${player.id}">
                        <span></span>
                    </label>
                    <i class="fa-solid fa-user"></i>
                    <div class='max'>${player.name}</div>
                `;
                list.appendChild(item);
            });
        }
    }
}

function sendMessage(msg)
{
    ws.send(JSON.stringify(msg));
}

function getAllPlayers()
{
    sendMessage({
        cmd: "getAllPlayer"
    });
}

(function() {

// d.getElementById('JoinAsGameMasterBtn').style.display = 'none';

    // sendMessage({
    //     cmd: "getGameStatus"
    // });

    if(window.location.pathname == '/data/players.html') {
        onClick('addPlayerForm', e => {
            e.preventDefault();

            const nameInput = document.getElementById('newPlayerName');
            const name = nameInput.value.trim();

            if (!isEmpty(name)) {
                sendMessage({
                    cmd: "addPlayer",
                    name: name
                });

                nameInput.value = '';
                getAllPlayers(); // Refresh the list
            }
        });

        onClick('confirmRemove',() => {
            if (selectedPlayerId) {
                sendMessage({
                    cmd: "removePlayer",
                    id: selectedPlayerId
                });
                selectedPlayerId = null;
                getAllPlayers();
            }
        });
    }
    if(window.location.pathname == '/game') {
        onClick('openPlayerModal',() => {
            getAllPlayers();
        });

        onClick('confirmSelected',() => {
            const checked = document.querySelectorAll('input[type="checkbox"][name="selectedPlayers"]:checked');
            const values = Array.from(checked).map(cb => cb.value);
            selectedPlayerList = values;
            const list = byId('selectedPlayerList');
            list.innerHTML = '';

            lastPlayerFetch.filter(player => selectedPlayerList.includes(player.id)).forEach((player, index) => {
                const item = document.createElement('li');
                item.id = player.id;
                item.innerHTML = `
                    <i class="fa-solid fa-user"></i>
                    <div class='max'>${player.name}</div>
                `;
                list.appendChild(item);
            });
        });
    }
})();
