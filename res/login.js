import {$} from "./common.js";
import {renderGame} from "./game.js";

// async function myTestFunction() {
//     try {
//         let response = await fetch("/bruhlmao");
//         console.log(response);
//     } catch (error) {
//         console.error(error);
//     }
// }
let loggedIn = false;
function doLogin() {
    console.log("logging in");
    // let username = $("#username-input").value;
    // let password = $("#password-input").value;
    $("#login-container").classList.add("hidden");
    loggedIn = true;
    renderGame();
}


$("#login-button").addEventListener("click", doLogin);
$("body").addEventListener("keydown", (event) => {
    if ((event.key !== "Enter") || loggedIn) {
        return;
    }
    doLogin();
});
