import threading

import flask
import simple_websocket
from flask_sock import Sock
import json

app = flask.Flask(__name__)

import pathlib

brick_storage = pathlib.Path(__file__).parent / "bricks.json"
if not brick_storage.exists():
    bricks = []
else:
    with brick_storage.open("r") as brick_file:
        bricks_from_json = json.load(brick_file)
    bricks = [tuple(brick) for brick in bricks_from_json]
# lock bricks_lock first!
def save_to_brick_storage():
    bricks_to_json = [list(brick) for brick in bricks]
    with brick_storage.open("w") as brick_out_file:
        json.dump(bricks_to_json, brick_out_file)

def root():
    return flask.render_template("index.html")

app.route("/")(root)

sock = Sock(app)
sockets_lock = threading.Lock()
sockets = []
bricks_lock = threading.Lock()

@sock.route('/multiplayer')
def echo(ws: simple_websocket.Server):
    try:
        with sockets_lock:
            sockets.append(ws)
        print("connected")
        with bricks_lock:
            ws.send(json.dumps({"type": "addMulti", "bricks": [list(brick) for brick in bricks]}))
        while True:
            data_json = ws.receive()
            data = json.loads(data_json)
            print(data)
            with bricks_lock:
                if data["type"] == "add":
                    bricks.append((data["x"], data["y"], data["z"]))
                elif data["type"] == "remove":
                    bricks.remove((data["x"], data["y"], data["z"]))
                save_to_brick_storage()
            with sockets_lock:
                for socket in sockets:
                    if socket == ws: continue
                    socket.send(data_json)
    except simple_websocket.ConnectionClosed:
        with sockets_lock:
            sockets.remove(ws)
        print("disconnected")

def resources(file_name: str):
    if ".." in file_name or file_name.startswith("/"):
        flask.abort(401)
    return flask.send_file("res/" + file_name)
app.route("/res/<string:file_name>")(resources)

app.run(host = "0.0.0.0", port = 443, ssl_context = ("fullchain.pem", "privkey.pem"))
