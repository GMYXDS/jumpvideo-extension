// 核心 链接 video控制 不同平台的适配 加载
var jve_websocket = null;
var jve_websocket_port = 6349;
var black_url = ["https://www.bilibili.com/"];
var black_query = ["csource", "spm_id_from"];
let video_index = [
  {url:"https://open.163.com/newview/movie/free",index:1}
];
var real_video_arr = null;
var choosed_video_index = 0;
var target_video_el = null;
let url_obj = null;
let buided_url = null;
let loop_interval = null;
// 只有满足条件启动了websocket,切回来的时候才重新启动
let can_init_websocket = false;
// window.addEventListener("DOMContentLoaded", function () {
//     init();
// });
window.onload = function () {
  chrome.runtime.sendMessage({ action: "get_flag" }, (response) => {
    const flag = response.status;
    if (flag) {
      console.log("jumpvideo-electorn loaded.");
      setTimeout(()=>{
        gm_trigger_click(document.querySelector("body"))
        init();
      },1000)
    }
  });
};
function init() {
  // todo，从后台拿到存储的black_url，black_query，video_index
  //废弃，手动配置

  // 获取url,一些白名单参数，是否跳转的判断
  url_obj = get_url_obj();
  if (!url_obj) return;

  // 先能正确获取视频，并加载UI
  const real_video_arr = get_all_video_el();
  console.log(real_video_arr);
  if (!real_video_arr) return; //如果没有视频元素，就不加载

  // 获取时间参数
  const jve = url_obj["url_obj"].query["jve"]; //11-15
  delete url_obj["url_obj"].query["jve"];
  // console.log(url_obj);
  buided_url = buildUrl(url_obj["url_obj"]); //获取一个纯净的链接/消除没用变化参数，消除自定义jve参数
  // 控制哪个video？一般都是一个,默认控制第一个。
  // 查看配置里面是否有配置
  for (let i = 0; i < video_index.length; i++) {
    if (buided_url.indexOf(video_index[i]["url"])!=-1) {
      choosed_video_index = video_index[i]["index"];
      break;
    }
  }
  target_video_el = real_video_arr[choosed_video_index];
  // video.addEventListener('loadeddata', function() {})
  // 实现获取视频相关信息的功能
  // 初始化socket，可以推送信息,接受信息
  init_websocket();
  can_init_websocket = true;
  // 然后再实现从链接跳浏览器的功能 处理跳转 todo
  //只有新打开的链接，才会走到这个jump,其余走socket推送
  if (url_obj["is_jump"]) {
    Toast("跳转中....");
    // 跳转过来的，不用判断视频的正确性
    if (jve.includes("-")) {
      const start = parseInt(jve.split("-")[0]);
      const end = parseInt(jve.split("-")[1]);
      v_set_current_seconds(start);
      v_play();
      if (loop_interval) stop_spy_play_status();
      loop_interval = setInterval(() => {
        spy_play_status(start, end, "ab");
      }, 1000);
    } else if (jve.includes("~")) {
      const start = jve.split("~")[0];
      const end = jve.split("~")[1];
      v_set_current_seconds(start);
      v_play();
      loop_interval = setInterval(() => {
        spy_play_status(start, end, "ab_circle");
      }, 1000);
    } else {
      const start = parseInt(jve);
      v_set_current_seconds(start);
      v_play();
    }
  }
  // 接着解决多浏览器窗口，多video元素，广告等问题！
  load_ui();
  // 监听页面显示/隐藏
  handle_visible();
}
function spy_play_status(start, end, type) {
  console.log("spying");
  if (target_video_el.paused == true) stop_spy_play_status();
  var current_time = v_get_current_seconds();
  if (type == "ab") {
    if (current_time > end || current_time < start) {
      v_pause();
      stop_spy_play_status();
    }
  } else if (type == "ab_circle") {
    if (current_time > end || current_time < start) {
      v_set_current_seconds(start);
      // clearInterval(loop_interval)
    }
  }
}
function stop_spy_play_status() {
  clearInterval(loop_interval);
  loop_interval = null;
}
// 只有前台标签页才接受推送信息
function handle_visible() {
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState == "visible") {
      if (!jve_websocket) {
        if (can_init_websocket) {
          // console.log('reconnet socket');
          init_websocket();
        }
      }
    } else {
      if (jve_websocket) jve_websocket.close();
    }
  });
}
function get_all_video_el() {
  let video_arr = Array.from(document.querySelectorAll("video"));
  document.querySelectorAll("iframe").forEach((iframe) => {
    if (!iframe.contentDocument) return;
    iframe.contentDocument.querySelectorAll("video").forEach((video) => {
      video_arr.push(video);
    });
  });
  if (video_arr.length == 0) return false;
  return video_arr;
}
function get_url_obj() {
  var raw_url = location.href;
  // 那些不需要运行的名单
  if (black_url.includes(raw_url)) return false;
  var result = parseUrl(raw_url);
  let is_jump = false;
  if (Object.keys(result.query).includes("jve")) is_jump = true;
  // console.log(result);
  return {
    is_jump: is_jump,
    url_obj: result,
    raw_url: raw_url,
  };
}
//获取一个纯净的链接/消除没用变化参数，消除自定义jve参数
function get_pure_url() {
  let raw_url = location.href;
  let result = parseUrl(raw_url);
  delete result.query["jve"];
  return buildUrl(result);
}

// 界面相关功能 //废弃
function load_ui() {
  var button_warp = `
    <div class="jve_con" id="draggable">
      <div class="btn">
        <div class="img">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 99.35 100">
            <defs>
              <linearGradient id="aea46ea21-aa15-4d07-98d9-2fd3f7319ba2" x1="74.04" y1="7.23" x2="25.84" y2="92.7"
                gradientUnits="userSpaceOnUse">
                <stop offset="0" stop-color="#f2a320" />
                <stop offset=".5" stop-color="#e145a8" />
                <stop offset="1" stop-color="#7252fa" />
              </linearGradient>
            </defs>
            <path d="M35.48 2.08a50 50 0 0 1 63.19 37.57z" fill="#f2a320" />
            <path
              d="M55.15 77.79l22.76 13.53a50.77 50.77 0 0 0 10.55-9.67L69 70.07zM3.46 31.11A49.15 49.15 0 0 0 0 45l20.57 12.23V41.28z"
              fill="#e145a8" />
            <path
              d="M34.5 87.27a13.9 13.9 0 0 1-13.92-13.84L1.19 61.9A50 50 0 0 0 62.5 98.35L41.08 85.62a13.9 13.9 0 0 1-6.58 1.65z"
              fill="#7252fa" />
            <path
              d="M82.92 50.33a7 7 0 0 1-3.57 6l-41.46 23.1a7 7 0 0 1-10.35-6.08V37l13.92 8.28V61.5L62 50.05l-20.54-12.2-30.2-18a7.55 7.55 0 0 1-.91-.66 50.29 50.29 0 0 1 10.34-9.9l58.82 34.96a6.93 6.93 0 0 1 3.41 6.08zm7 .3A14 14 0 0 1 83 62.23l12.65 7.52a49.63 49.63 0 0 0 3.66-13.5z"
              fill="url(#aea46ea21-aa15-4d07-98d9-2fd3f7319ba2)" />
          </svg>
        </div>
      </div>
  `;
  var title = document.querySelector("body");
  title.insertAdjacentHTML("beforeBegin", button_warp);
  init_draggable();
  close_con();
}
function close_con() {
  var myDiv = document.getElementById("draggable");
  myDiv.addEventListener("dblclick", function () {
    myDiv.parentNode.removeChild(myDiv);
  });
}
function init_draggable() {
  var draggable = document.getElementById("draggable");
  var offsetX, offsetY;
  draggable.onmousedown = function (e) {
    e.preventDefault();
    offsetX = e.clientX - draggable.offsetLeft;
    offsetY = e.clientY - draggable.offsetTop;
    document.onmousemove = function (e) {
      var x = e.clientX - offsetX;
      var y = e.clientY - offsetY;
      x = Math.max(0, Math.min(x, window.innerWidth - draggable.offsetWidth));
      y = Math.max(0, Math.min(y, window.innerHeight - draggable.offsetHeight));
      draggable.style.left = x + "px";
      draggable.style.top = y + "px";
    };
    document.onmouseup = function () {
      document.onmousemove = null;
      document.onmouseup = null;
    };
  };
}
// websocket 相关功能
function init_websocket() {
  jve_websocket = new WebSocket(`ws://127.0.0.1:${jve_websocket_port}`);

  jve_websocket.addEventListener("open", (event) => {
    // console.log("Connected to WebSocket server");
  });

  jve_websocket.addEventListener("message", (event) => {
    let data = event.data;
    // console.log("Message from server: ", data);
    if (data.toString().startsWith("{")) {
      data = JSON.parse(data);
      websocket_handle_msg(data);
    } else {
      console.log("not json data");
    }
  });

  jve_websocket.addEventListener("close", (event) => {
    // console.log("WebSocket connection closed");
    jve_websocket = null;
  });

  jve_websocket.addEventListener("error", (event) => {
    console.error("WebSocket error: ", event);
    jve_websocket = null;
  });
}
function websocket_handle_msg(msg) {
  let new_build_url = get_pure_url();
  if (msg["type"] == "jump") {
    // 判断是不是当前视频，跳转or，直接跳转到新的标签页面
    if (msg["data"]["video_path"] != new_build_url) {
      v_pause();
      var add_time_url = parseUrl(msg["data"]["video_path"]);
      if (msg["data"]["play_type"] == "link") {
        add_time_url.query["jve"] = msg["data"]["target_time"];
      } else if (msg["data"]["play_type"] == "ab") {
        add_time_url.query["jve"] = msg["data"]["target_time"] + "-" + msg["data"]["target_time1"];
      } else if (msg["data"]["play_type"] == "ab_circle") {
        add_time_url.query["jve"] = msg["data"]["target_time"] + "~" + msg["data"]["target_time1"];
      }
      v_pause();
      openNewTab(buildUrl(add_time_url));
    } else {
      if (msg["data"]["play_type"] == "ab") {
        const start = msg["data"]["target_time"];
        const end = msg["data"]["target_time1"];
        v_set_current_seconds(start);
        v_play();
        if (loop_interval) stop_spy_play_status();
        loop_interval = setInterval(() => {
          spy_play_status(start, end, "ab");
        }, 1000);
      } else if (msg["data"]["play_type"] == "ab_circle") {
        const start = msg["data"]["target_time"];
        const end = msg["data"]["target_time1"];
        v_set_current_seconds(start);
        v_play();
        loop_interval = setInterval(() => {
          spy_play_status(start, end, "ab_circle");
        }, 1000);
      } else {
        v_set_current_seconds(msg["data"]["target_time"]);
        v_play();
      }
    }
  } else if (msg["type"] == "shortcut_link") {
    shortcut_link();
  } else if (msg["type"] == "shortcut_img") {
    shortcut_img();
  } else if (msg["type"] == "shortcut_img_edit") {
    shortcut_img_edit();
  } else if (msg["type"] == "shortcut_ab") {
    shortcut_ab();
  } else if (msg["type"] == "shortcut_ab_circle") {
    shortcut_ab_circle();
  }
}
function websocket_send_msg(msg) {
  if (!jve_websocket) return;
  // const msg = {
  //     type: "greeting",
  //     content: "Hello, WebSocket!",
  // };
  jve_websocket.send(JSON.stringify(msg));
}
function send_msg_back(msg) {
  websocket_send_msg({
    type: "notice",
    data: msg,
  });
}
function get_tar_title() {
  let video_title = ""
  try {
    if (buided_url.includes("aliyundrive.com") || buided_url.includes("alipan.com")) {
      video_title = document.querySelector(".text--KBVB3").textContent;
    } else if (buided_url.includes("cloud.189.cn")) {
      video_title = document.querySelector(".video-title").textContent;
    } else if (buided_url.includes("pan.xunlei")) {
      video_title = document.querySelector(".video-name").textContent.trim();
    } else if (buided_url.includes("www.bilibili.com/cheese/play/")) {
      video_title = document.querySelector(".archive-title-box-txt").textContent.trim();
    } else if (buided_url.includes("www.bilibili.com")) {
      video_title = document.querySelector(".video-title").textContent.trim();
    }else if (buided_url.includes("pan.baidu.com")) {
      video_title = document.querySelectorAll(".vp-toolsbar__title")[1].textContent.trim();
    }
  } catch (error) { }
  if(video_title=="" || video_title==undefined){
    return window.document.title;
  }else{
    return video_title
  }
}
// 响应快捷键功能
function shortcut_link() {
  // 获取链接发送到后端
  // 获取link，获取title,获取时间
  let current_time = v_get_current_seconds();
  let current_time_str = secondsToTimeString(current_time);
  let video_title = get_tar_title();
  let new_build_url = get_pure_url();

  websocket_send_msg({
    type: "shortcut_link",
    data: {
      video_path: new_build_url,
      type: "web", // web
      target_time: current_time,
      target_time1: 0,
      target_time_str: current_time_str,
      target_time_str1: "",
      play_type: "link", // link | ab | ab_circle
      source_filename: video_title,
      source_ext: "",
    },
  });
}
function shortcut_img() {
  websocket_send_msg({
    type: "shortcut_img",
    data: {
      imgbase64: v_get_current_snapshot(),
    },
  });
}
function shortcut_img_edit() {
  websocket_send_msg({
    type: "shortcut_img_edit",
    data: {
      imgbase64: v_get_current_snapshot(),
    },
  });
}
let ab_flag = false;
let first_info = "";
function shortcut_ab() {
  // 获取link，获取title,获取时间
  let current_time = v_get_current_seconds();
  let current_time_str = secondsToTimeString(current_time);
  let video_title = get_tar_title();
  let new_build_url = get_pure_url();
  if (ab_flag == false) {
    //按下a
    first_info = {
      video_path: new_build_url,
      target_time: current_time,
      target_time_str: current_time_str,
      source_filename: video_title,
    };
    ab_flag = true;
    send_msg_back("ab片段[起点]获取成功！再按一次生成链接！");
    Toast("ab片段[起点]获取成功！再按一次生成链接！");
  } else {
    // 默认暂停
    v_pause();
    if (first_info == "") {
      first_info = "";
      ab_flag = false;
      send_msg_back("ab片段信息错误，请重新开始");
      Toast("ab片段信息错误，请重新开始");
      return;
    }
    let ab_info = {
      video_path: new_build_url,
      type: "web", // web
      target_time: current_time,
      target_time1: current_time,
      target_time_str: current_time_str,
      target_time_str1: current_time_str,
      play_type: "ab", // link | ab | ab_circle
      source_filename: video_title,
      source_ext: "",
    };
    if (first_info["target_time"] < current_time) {
      //b大于a 正常的
      ab_info["target_time"] = first_info["target_time"];
      ab_info["target_time_str"] = first_info["target_time_str"];
    } else {
      //a大于b 调换
      ab_info["target_time1"] = first_info["target_time"];
      ab_info["target_time_str1"] = first_info["target_time_str"];
    }
    websocket_send_msg({ type: "shortcut_ab", data: ab_info });
    // send_msg_back('ab片段链接生成成功！按Ctrl+V粘贴！')
    ab_flag = false;
    first_info = "";
  }
}
function shortcut_ab_circle() {
  // 获取link，获取title,获取时间
  let current_time = v_get_current_seconds();
  let current_time_str = secondsToTimeString(current_time);
  let video_title = get_tar_title();
  let new_build_url = get_pure_url();
  if (ab_flag == false) {
    //按下a
    first_info = {
      video_path: new_build_url,
      target_time: current_time,
      target_time_str: current_time_str,
      source_filename: video_title,
    };
    ab_flag = true;
    send_msg_back("ab循环[起点]获取成功！再按一次生成链接！");
    Toast("ab循环[起点]获取成功！再按一次生成链接！");
  } else {
    // 默认暂停
    v_pause();
    if (first_info == "") {
      first_info = "";
      ab_flag = false;
      send_msg_back("ab循环信息错误，请重新开始");
      Toast("ab循环信息错误，请重新开始");
      return;
    }
    let ab_info = {
      video_path: new_build_url,
      type: "web", // web
      target_time: current_time,
      target_time1: current_time,
      target_time_str: current_time_str,
      target_time_str1: current_time_str,
      play_type: "ab_circle", // link | ab | ab_circle
      source_filename: video_title,
      source_ext: "",
    };
    if (first_info["target_time"] < current_time) {
      //b大于a 正常的
      ab_info["target_time"] = first_info["target_time"];
      ab_info["target_time_str"] = first_info["target_time_str"];
    } else {
      //a大于b 调换
      ab_info["target_time1"] = first_info["target_time"];
      ab_info["target_time_str1"] = first_info["target_time_str"];
    }
    websocket_send_msg({ type: "shortcut_ab_circle", data: ab_info });
    // send_msg_back('ab循环链接生成成功！按Ctrl+V粘贴！')
    ab_flag = false;
    first_info = "";
  }
}

// 操作视频相关功能
function v_play() {
  if (target_video_el) {
    if (buided_url.includes("aliyundrive.com") || buided_url.includes("alipan.com")) {
      document.querySelectorAll(".btn--UrTVT")[1].click();
    }
    try {
      target_video_el.play();
    } catch (error) { }
  }
}
function v_pause() {
  if (target_video_el) {
    target_video_el.pause();
  }
}
function v_get_current_seconds() {
  if (target_video_el) {
    return Math.ceil(target_video_el.currentTime);
  }
}
function v_set_current_seconds(seconds) {
  if (target_video_el) {
    target_video_el.currentTime = seconds;
  }
}
function v_get_current_snapshot() {
  const canvas = document.createElement("canvas");
  canvas.width = target_video_el.videoWidth;
  canvas.height = target_video_el.videoHeight;
  const context = canvas.getContext("2d");
  context.drawImage(target_video_el, 0, 0, canvas.width, canvas.height);
  const dataURL = canvas.toDataURL("image/png");
  return dataURL;
  // const img = new Image();
  // img.src = dataURL;
  // document.body.appendChild(img);
}

String.prototype.replaceAll = function (s1, s2) {
  return this.replace(new RegExp(s1, "gm"), s2);
};

function parseUrl(url) {
  const urlObj = new URL(url);
  const queryParams = {};
  urlObj.searchParams.forEach((value, key) => {
    if (black_query.includes(key)) return;
    queryParams[key] = value;
  });
  return {
    protocol: urlObj.protocol,
    username: urlObj.username,
    password: urlObj.password,
    hostname: urlObj.hostname,
    port: urlObj.port,
    pathname: urlObj.pathname,
    search: urlObj.search,
    query: queryParams,
    hash: urlObj.hash,
  };
}

function buildUrl(parsedUrl) {
  const urlObj = new URL(`${parsedUrl.protocol}//${parsedUrl.hostname}`);
  if (parsedUrl.username) {
    urlObj.username = parsedUrl.username;
  }
  if (parsedUrl.password) {
    urlObj.password = parsedUrl.password;
  }
  if (parsedUrl.port) {
    urlObj.port = parsedUrl.port;
  }
  urlObj.pathname = parsedUrl.pathname;
  Object.keys(parsedUrl.query).forEach((key) => {
    urlObj.searchParams.append(key, parsedUrl.query[key]);
  });
  if (parsedUrl.hash) {
    urlObj.hash = parsedUrl.hash;
  }
  return urlObj.toString();
}

function secondsToTimeString(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  const hoursStr = String(hours).padStart(2, "0");
  const minutesStr = String(minutes).padStart(2, "0");
  const secondsStr = String(remainingSeconds).padStart(2, "0");

  return `${hoursStr}:${minutesStr}:${secondsStr}`;
}

function openNewTab(url) {
  var a = document.createElement("a");
  a.href = url;
  a.target = "_blank";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function openNewTab2(url) {
  window.open(url, "_blank");
}

//界面toast提示
function Toast(msg, duration) {
  duration = isNaN(duration) ? 3000 : duration;
  var m = document.createElement("div");
  m.innerHTML = msg;
  m.style.cssText =
    "font-family:siyuan;max-width:60%;min-width: 150px;padding:0 14px;height: auto;color: rgb(255, 255, 255);line-height: 40px;text-align: center;border-radius: 4px;position: fixed;bottom: 10%;left: 50%;transform: translate(-50%, -50%);z-index: 999999;background: rgba(0, 0, 0,.7);font-size: 16px;";
  document.body.appendChild(m);
  setTimeout(function () {
    var d = 0.5;
    m.style.webkitTransition = "-webkit-transform " + d + "s ease-in, opacity " + d + "s ease-in";
    m.style.opacity = "0";
    setTimeout(function () {
      document.body.removeChild(m);
    }, d * 1000);
  }, duration);
}

function gm_trigger_click(element) {
  var event = new MouseEvent('click', {
      'view': window,
      'bubbles': true,
      'cancelable': true
  });
  element.dispatchEvent(event);
}