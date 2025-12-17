var d = document;
// var gateway = `ws://${window.location.hostname}/ws`;
var gateway = `ws://192.168.178.90/ws`;
var ws;
const s = t => t/1000;
const isEmpty = str => !str?.length;
const byId = id => d.getElementById(id);
const upt = (id, val) => { if(byId(id).innerHTML.trim() != val) byId(id).innerHTML = val };
const onClick = (id, cb) => byId(id).addEventListener('click', cb);
const hide = (id) => byId(id).style.display = 'none';
const show = (id) => byId(id).style.display = 'block';
const isPage = (...paths) => {
  const current = window.location.pathname.replace(/\/+$/, '');
  return paths.some(path => current === path.replace(/\/+$/, ''));
};
window.addEventListener('load', onLoad);

var selectedPlayerId = null;
var selectedPlayerList = [];
var lastPlayerFetch = null;
var gameState = "unknown";

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

    if(isPage('/data/players.html', '/players')) {
        sendMessage({
            cmd: "getAllPlayer"
        });
    }

    if(isPage('/data/game.html', '/game')) {
        sendMessage({
            cmd: "getGameStatus"
        });
    }
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

        if(isPage('/data/players.html', '/players')) {
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

        if(isPage('/data/game.html', '/game')) {
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

    if(data.game) {
        var g = data.game;
        var state = g.status;
        d.querySelectorAll('#gameStateSelector button.active').forEach(btn => {
            btn.classList.remove('active');
        });
        byId(`state${state.charAt(0).toUpperCase() + state.slice(1)}`).classList.add('active');

        if(data.cmd === "getGameStatus" || data.cmd === "setGameStatus") {
            hide('spinner');

            if(state == "unknown") {
                show('viewSetup');
            } else if(state == "created" || state == "running") {
                showGameInfo();
                populatePlayers(g);
            }
        }
    }
}

function sendMessage(msg)
{
    ws.send(JSON.stringify(msg));
}

function showGameInfo()
{
    hide('viewSetup');
    show('viewGame');
}

function populatePlayers(data)
{
    const list = byId('activePlayerList');
    list.innerHTML = '';
    console.log(data);
    data.players.forEach((player, index) => {
        const item = document.createElement('article');
        item.id = player.id;
        item.classList.add('playerCard');
        item.innerHTML = `
            <div class="grid no-space">
                <div class="s4 center-align">
                    <h4 class="currentPoints" style="padding:.5rem;"><b>187</b></h4>
                    <div style="padding:.5rem;">${player.name}</div>
                </div>
                <div class="s4 center-align" style="display: flex;flex-direction:column;align-items: stretch;height: 100%;">
                    <div class="throwGroup">
                        <div class="s4">
                            <span class="s4 center-align">0</span>
                        </div>
                        <div class="s4">
                            <span class="s4 center-align">1</span>
                        </div>
                        <div class="s4">
                            <span class="s4 center-align">2</span>
                        </div>
                    </div>
                    <div class="s4 center-align" style="display: flex;flex-direction:column;flex:3;">
                        <h6>333</h6>
                    </div>
                </div>
                <div class="s4 center-align" style="display: flex;flex-direction:column;align-items: stretch;height: 100%;">
                    <div class="details" style="flex: 1;">
                        <div class="s6">
                            <i class="fa-brands fa-dart-lang"></i>
                        </div>
                        <div class="s6">
                            <span id="numOfThrows">0</span>
                        </div>
                    </div>
                    <div class="s4 center-align" style="flex: 1;">
                        <div>
                            &Oslash;
                            <span class="averagePoints">333</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        list.appendChild(item);
    });
}

(function() {

// d.getElementById('JoinAsGameMasterBtn').style.display = 'none';

    if(isPage('/data/players.html', '/players')) {
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
                sendMessage({
                    cmd: "getAllPlayer"
                });
            }
        });

        onClick('confirmRemove',() => {
            if (selectedPlayerId) {
                sendMessage({
                    cmd: "deletePlayer",
                    id: selectedPlayerId
                });
                selectedPlayerId = null;
                sendMessage({
                    cmd: "getAllPlayer"
                });
            }
        });
    }

    if(isPage('/data/game.html', '/game')) {
        onClick('openPlayerModal',() => {
            sendMessage({
                cmd: "getAllPlayer"
            });
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

            sendMessage({
                cmd: 'selectPlayers',
                playerIds: selectedPlayerList
            });
        });

        onClick('startGame', e => {
            e.preventDefault();
            sendMessage({
                cmd: 'startGame'
            });
        });

        ['unknown','created','running','done','aborted','error'].forEach(e => {
            console.log(`state${e.charAt(0).toUpperCase() + e.slice(1)}`);
            onClick(`state${e.charAt(0).toUpperCase() + e.slice(1)}`, item => {
                sendMessage({
                    cmd: 'setGameStatus',
                    s: e
                });
            });
        });

    }
})();
