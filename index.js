const characters = ["A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z","a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9","~","`","!","@","#","$","%","^","&","*","(",")","_","-","+","=","{","[","}","]",",","|",":",";","<",">",".","?",
"/"];

function createPassword() {
    let password = ""
    for (let i = 0; i < 15; i++) {
        let num = Math.floor( Math.random() * characters.length )
        password += characters[num]
    }
    return password
}

function generatePassword() {
    let password1 = createPassword()
    let password2 = createPassword()
    document.getElementById("password1").textContent = password1
    document.getElementById("password2").textContent = password2
}

function copyText(e) {
    const clickedText = e.target.textContent;
    navigator.clipboard.writeText(clickedText)
    e.target.textContent = "Copied to clipboard!"
    setTimeout(() => {
        e.target.textContent = clickedText;
    }, 2000);
}


