var input_el = document.querySelector(".mui-switch-anim");
document.querySelector(".open_btn").addEventListener("click",()=>{
    set_flag(input_el.checked)
})

chrome.runtime.sendMessage({action: 'get_flag'}, response => {
    const flag = response.status;
    input_el.checked = flag;
});

function set_flag(status){
    chrome.runtime.sendMessage({action: 'set_flag',status:status}, response => {});
}