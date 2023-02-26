let gameState;
let ws;

export async function setupNetwork(gameState_) {
    return new Promise((resolve, reject) => {
        try {
            gameState = gameState_;

            ws = new WebSocket("wss://" + window.location.host + "/multiplayer");
            ws.addEventListener("open", () => {
                resolve({ // network state
                    onBrickAdd: onLocalBrickAdd,
                    onBrickRemove: onLocalBrickRemove
                });
            });
            ws.addEventListener("message", event => onRemoteMessage(JSON.parse(event.data)));
        } catch (error) {
            reject(error);
        }
    });
}

function onRemoteMessage(message) {
    console.log(message);
    if (message["type"] === "add") {
        gameState.onBrickAdd(message["x"], message["y"], message["z"]);
    } else if (message["type"] === "addMulti") {
        for (let brick of message["bricks"]) {
            gameState.onBrickAdd(brick[0], brick[1], brick[2]);
        }
    } else { // message["type"] === "remove"
        gameState.onBrickRemove(message["x"], message["y"], message["z"]);
    }
}

function onLocalBrickAdd(x, y, z) {
    ws.send(JSON.stringify({type: "add", x: x, y: y, z: z}));
}

function onLocalBrickRemove(x, y, z) {
    ws.send(JSON.stringify({type: "remove", x: x, y: y, z: z}));
}
