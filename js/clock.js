(function () {
  function parseHHMM(value, fallback) {
    if (!value || !value.includes(":")) {
      return fallback;
    }
    var parts = value.split(":");
    var h = Number(parts[0]);
    var m = Number(parts[1]);
    if (Number.isNaN(h) || Number.isNaN(m)) {
      return fallback;
    }
    return { h: h, m: m };
  }

  function toMinute(h, m) {
    return h * 60 + m;
  }

  function secondsToMMSS(seconds) {
    var safe = Math.max(0, Math.floor(seconds));
    var mm = Math.floor(safe / 60);
    var ss = safe % 60;
    return String(mm).padStart(2, "0") + ":" + String(ss).padStart(2, "0");
  }

  function computeLunchState(nowDate, lunchStartText, lunchEndText) {
    var start = parseHHMM(lunchStartText, { h: 12, m: 30 });
    var end = parseHHMM(lunchEndText, { h: 13, m: 20 });
    var nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
    var startMinutes = toMinute(start.h, start.m);
    var endMinutes = toMinute(end.h, end.m);

    var state;
    var remainMinutes;
    var helpText;

    if (nowMinutes < startMinutes) {
      state = "점심전";
      remainMinutes = startMinutes - nowMinutes;
      helpText = "점심 시작까지 남은 시간";
    } else if (nowMinutes >= startMinutes && nowMinutes < endMinutes) {
      state = "점심중";
      remainMinutes = endMinutes - nowMinutes;
      helpText = "점심 종료까지 남은 시간";
    } else {
      state = "점심끝";
      remainMinutes = 0;
      helpText = "오늘 점심시간이 끝났어요";
    }

    var queue;
    if (nowMinutes < startMinutes) {
      queue = 0;
    } else {
      var diff = nowMinutes - startMinutes;
      if (diff < 5) {
        queue = 12;
      } else if (diff < 15) {
        queue = 8;
      } else if (diff < 25) {
        queue = 5;
      } else {
        queue = 2;
      }
    }

    return {
      state: state,
      remainText: String(Math.floor(remainMinutes / 60)).padStart(2, "0") + ":" + String(remainMinutes % 60).padStart(2, "0"),
      helpText: helpText,
      queueMinutes: queue
    };
  }

  window.LunchClock = {
    computeLunchState: computeLunchState,
    secondsToMMSS: secondsToMMSS
  };
})();
