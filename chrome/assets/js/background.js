chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'get_flag') {
        chrome.storage.local.get('flag', data => {
            let new_status  = data.flag??false;
            sendResponse({status:new_status});
        });
        return true; // 表示异步发送响应
    }else if (request.action === 'set_flag') {
        chrome.storage.local.set({flag: request.status}, () => {});
        sendResponse({});
        return true; // 表示异步发送响应
    }
});


