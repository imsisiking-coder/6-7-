(function () {
  var STORAGE_KEY = "meal-go-settings";
  var DEVICE_ID_STORAGE_KEY = "meal-go-device-id";
  var PUBLIC_CONFIG = window.MEAL_GO_PUBLIC_CONFIG || {};
  var STICKERS = [
    { key: "yummy", icon: "😋", label: "꿀맛" },
    { key: "good", icon: "🙂", label: "괜찮음" },
    { key: "soso", icon: "😐", label: "보통" },
    { key: "bad", icon: "😖", label: "별로" }
  ];

  var defaultSettings = {
    apiKey: PUBLIC_CONFIG.apiKey || "",
    schoolName: PUBLIC_CONFIG.schoolName || "",
    officeCode: PUBLIC_CONFIG.officeCode || "",
    schoolCode: PUBLIC_CONFIG.schoolCode || "",
    lunchStart: PUBLIC_CONFIG.lunchStart || "12:30",
    lunchEnd: PUBLIC_CONFIG.lunchEnd || "13:20"
  };

  function readSettings() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return Object.assign({}, defaultSettings);
      }
      return Object.assign({}, defaultSettings, JSON.parse(raw));
    } catch (e) {
      return Object.assign({}, defaultSettings);
    }
  }

  function saveSettings(value) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  }

  function getOrCreateDeviceId() {
    var current = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (current) {
      return current;
    }

    var newId = "d-" + Math.random().toString(36).slice(2, 11) + "-" + Date.now().toString(36);
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, newId);
    return newId;
  }

  async function fetchServerVotes(dateKey) {
    var response = await fetch("/api/votes?date=" + encodeURIComponent(dateKey) + "&deviceId=" + encodeURIComponent(deviceId), {
      method: "GET",
      headers: {
        "Accept": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error("vote_fetch_failed");
    }

    return response.json();
  }

  async function submitServerVote(dateKey, dishName, stickerKey) {
    var response = await fetch("/api/votes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        dateKey: dateKey,
        dishName: dishName,
        stickerKey: stickerKey,
        deviceId: deviceId
      })
    });

    var result = {};
    try {
      result = await response.json();
    } catch (e) {
      result = {};
    }

    if (!response.ok) {
      var err = new Error(result.error || "vote_submit_failed");
      err.code = response.status;
      err.payload = result;
      throw err;
    }

    return result;
  }

  async function submitServerVoteWithRetry(dateKey, dishName, stickerKey) {
    try {
      return await submitServerVote(dateKey, dishName, stickerKey);
    } catch (e) {
      if (e.code && e.code >= 400 && e.code < 500) {
        throw e;
      }
      return submitServerVote(dateKey, dishName, stickerKey);
    }
  }

  var settings = readSettings();
  var ratings = {};
  var myVotes = {};
  var deviceId = getOrCreateDeviceId();

  var elCountdown = document.getElementById("countdown");
  var elClockState = document.getElementById("clockState");
  var elClockHelp = document.getElementById("clockHelp");
  var elQueueWait = document.getElementById("queueWait");

  var elMealDate = document.getElementById("mealDate");
  var elMealList = document.getElementById("mealList");
  var elMealCalories = document.getElementById("mealCalories");
  var elMealAllergy = document.getElementById("mealAllergy");
  var elMealStatus = document.getElementById("mealStatus");
  var elMealDateInput = document.getElementById("mealDateInput");
  var elMealTopRanks = document.getElementById("mealTopRanks");

  var elSettingsBtn = document.getElementById("settingsBtn");
  var elSettingsDialog = document.getElementById("settingsDialog");
  var elSettingsForm = document.getElementById("settingsForm");
  var elCancelSettingsBtn = document.getElementById("cancelSettingsBtn");
  var elRefreshMealBtn = document.getElementById("refreshMealBtn");

  var elApiKey = document.getElementById("apiKey");
  var elCopyApiKeyBtn = document.getElementById("copyApiKeyBtn");
  var elSchoolName = document.getElementById("schoolName");
  var elOfficeCode = document.getElementById("officeCode");
  var elSchoolCode = document.getElementById("schoolCode");
  var elLunchStart = document.getElementById("lunchStart");
  var elLunchEnd = document.getElementById("lunchEnd");

  var selectedMealDate = new Date();
  var currentMealData = null;

  function formatInputDate(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, "0");
    var d = String(date.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  function parseInputDate(value) {
    if (!value) return new Date();
    var parts = value.split("-");
    if (parts.length !== 3) return new Date();
    var y = Number(parts[0]);
    var m = Number(parts[1]) - 1;
    var d = Number(parts[2]);
    var date = new Date(y, m, d);
    return Number.isNaN(date.getTime()) ? new Date() : date;
  }

  function syncSettingsForm() {
    elApiKey.value = settings.apiKey;
    elSchoolName.value = settings.schoolName;
    elOfficeCode.value = settings.officeCode;
    elSchoolCode.value = settings.schoolCode;
    elLunchStart.value = settings.lunchStart;
    elLunchEnd.value = settings.lunchEnd;
  }

  function renderClock() {
    var current = window.LunchClock.computeLunchState(new Date(), settings.lunchStart, settings.lunchEnd);
    elCountdown.textContent = current.remainText;
    elClockState.textContent = current.state;
    elClockHelp.textContent = current.helpText;
    elQueueWait.textContent = current.queueMinutes + "분";
  }

  function getCurrentDateKey() {
    return window.MealApi.ymd(selectedMealDate);
  }

  function emptyStickerCounts() {
    return {
      yummy: 0,
      good: 0,
      soso: 0,
      bad: 0
    };
  }

  function getDishRating(dateKey, dishName) {
    if (!ratings[dateKey]) {
      ratings[dateKey] = {};
    }
    if (!ratings[dateKey][dishName]) {
      ratings[dateKey][dishName] = emptyStickerCounts();
    }
    return ratings[dateKey][dishName];
  }

  function getMyVotesForDate(dateKey) {
    var dayVotes = myVotes[dateKey];
    if (!dayVotes) {
      myVotes[dateKey] = {};
      return myVotes[dateKey];
    }

    return dayVotes;
  }

  function setVotesFromServer(dateKey, payload) {
    ratings[dateKey] = payload && payload.ratings && typeof payload.ratings === "object" ? payload.ratings : {};
    myVotes[dateKey] = payload && payload.myVotes && typeof payload.myVotes === "object" ? payload.myVotes : {};
  }

  function getMealRankRows(dateKey, items) {
    var dayRatings = ratings[dateKey] || {};
    var rows = items.map(function (item, idx) {
      var counts = dayRatings[item.name] || emptyStickerCounts();
      var total = counts.yummy + counts.good;
      return {
        dishName: item.name,
        likes: total,
        idx: idx
      };
    });

    rows.sort(function (a, b) {
      if (b.likes !== a.likes) {
        return b.likes - a.likes;
      }
      return a.idx - b.idx;
    });

    return rows.slice(0, 2);
  }

  function renderMealTopRanks(rows) {
    elMealTopRanks.innerHTML = "";

    if (!rows.length) {
      var empty = document.createElement("p");
      empty.className = "meal-top-empty";
      empty.textContent = "랭킹을 표시할 메뉴가 없어요.";
      elMealTopRanks.appendChild(empty);
      return;
    }

    rows.forEach(function (row, i) {
      var li = document.createElement("li");

      var left = document.createElement("div");
      left.className = "rank-left";

      var badge = document.createElement("span");
      badge.className = "rank-badge " + (i === 0 ? "first" : "second");
      badge.textContent = i === 0 ? "1등" : "2등";

      var dish = document.createElement("span");
      dish.className = "rank-dish";
      dish.textContent = row.dishName;

      var score = document.createElement("span");
      score.className = "rank-score";
      score.textContent = "좋아요 " + row.likes + "표";

      left.appendChild(badge);
      left.appendChild(dish);

      li.appendChild(left);
      li.appendChild(score);
      elMealTopRanks.appendChild(li);
    });
  }

  function renderMeal(data) {
    var dateKey = getCurrentDateKey();
    var myVotesForDate = getMyVotesForDate(dateKey);
    var completedVotes = 0;
    var totalVotes = 0;

    elMealDate.textContent = "날짜: " + dateKey;
    elMealList.innerHTML = "";

    data.items.forEach(function (item) {
      var li = document.createElement("li");
      li.className = "meal-vote-item";

      var head = document.createElement("div");
      head.className = "meal-vote-head";

      var name = document.createElement("strong");
      name.className = "meal-name";
      name.textContent = item.name;

      var kcal = document.createElement("span");
      kcal.className = "meal-kcal";
      kcal.textContent = item.kcal;

      head.appendChild(name);
      head.appendChild(kcal);
      li.appendChild(head);

      var group = document.createElement("div");
      group.className = "meal-sticker-group";

      var counts = getDishRating(dateKey, item.name);
      var myDishVote = myVotesForDate[item.name] || null;
      if (myDishVote) {
        completedVotes += 1;
      }

      STICKERS.forEach(function (sticker) {
        var count = counts[sticker.key] || 0;
        totalVotes += count;

        var btn = document.createElement("button");
        var isSelected = myDishVote && myDishVote.stickerKey === sticker.key;
        btn.type = "button";
        btn.className = "meal-sticker-btn" + (count > 0 ? " has-votes" : "") + (isSelected ? " selected" : "");
        btn.dataset.dish = item.name;
        btn.dataset.sticker = sticker.key;
        btn.setAttribute("aria-label", item.name + " " + sticker.label + " 평가");
        if (myDishVote) {
          btn.disabled = true;
        }
        btn.textContent = sticker.icon + " " + count;
        group.appendChild(btn);
      });

      li.appendChild(group);
      elMealList.appendChild(li);
    });

    elMealCalories.textContent = data.totalCalories;
    elMealAllergy.textContent = data.allergy;

    var voteText = totalVotes > 0
      ? "음식별 스티커 투표 " + completedVotes + "/" + data.items.length + " 완료"
      : "음식 이름 옆 스티커로 바로 평가해 주세요.";

    elMealStatus.textContent = (data.source === "neis" ? "NEIS 실데이터를 불러왔습니다. " : "설정 정보가 없어 샘플 급식을 표시합니다. ") + voteText;

    var rankRows = getMealRankRows(dateKey, data.items);
    renderMealTopRanks(rankRows);
  }

  async function addStickerVote(dishName, stickerKey) {
    var dateKey = getCurrentDateKey();
    var myVotesForDate = getMyVotesForDate(dateKey);
    if (myVotesForDate[dishName]) {
      window.alert("이 음식은 이미 평가했어요.");
      return;
    }

    if (!Object.prototype.hasOwnProperty.call(emptyStickerCounts(), stickerKey)) {
      return;
    }

    try {
      var result = await submitServerVoteWithRetry(dateKey, dishName, stickerKey);
      setVotesFromServer(dateKey, result);
      if (currentMealData) {
        renderMeal(currentMealData);
      }
    } catch (e) {
      if (e.code === 409) {
        setVotesFromServer(dateKey, e.payload || {});
        if (currentMealData) {
          renderMeal(currentMealData);
        }
        window.alert("이 음식은 이미 평가했어요.");
        return;
      }
      if (e && e.payload && e.payload.error === "vote_store_failed") {
        window.alert("서버 저장이 잠시 불안정해요. 다시 눌러주세요.");
        return;
      }
      window.alert("투표 전송에 실패했어요. 새로고침 후 다시 시도해 주세요.");
    }
  }

  async function autoFillSchoolCodes(showAlertOnFail) {
    var apiKey = elApiKey.value.trim();
    var schoolName = elSchoolName.value.trim();

    if (!apiKey || !schoolName) {
      return false;
    }

    elMealStatus.textContent = "학교 정보를 조회하는 중...";
    var schoolInfo = await window.MealApi.findSchoolByName(apiKey, schoolName);

    if (!schoolInfo) {
      if (showAlertOnFail) {
        window.alert("학교 정보를 찾지 못했습니다. 학교 이름을 다시 확인해 주세요.");
      }
      return false;
    }

    elSchoolName.value = schoolInfo.schoolName;
    elOfficeCode.value = schoolInfo.officeCode;
    elSchoolCode.value = schoolInfo.schoolCode;
    return true;
  }

  async function refreshMeal() {
    elMealStatus.textContent = "급식 정보를 불러오는 중...";
    var dateKey = window.MealApi.ymd(selectedMealDate);
    var meal = await window.MealApi.fetchTodayMeal(settings, dateKey);
    try {
      var votePayload = await fetchServerVotes(dateKey);
      setVotesFromServer(dateKey, votePayload);
    } catch (e) {
      ratings[dateKey] = ratings[dateKey] || {};
      myVotes[dateKey] = myVotes[dateKey] || {};
      elMealStatus.textContent = "투표 서버 연결이 불안정해요. 새로고침 후 다시 시도해 주세요.";
    }
    currentMealData = meal;
    renderMeal(meal);
  }

  function bindEvents() {
    elSettingsBtn.addEventListener("click", function () {
      syncSettingsForm();
      elSettingsDialog.showModal();
    });

    elCancelSettingsBtn.addEventListener("click", function () {
      elSettingsDialog.close();
    });

    elCopyApiKeyBtn.addEventListener("click", function () {
      var val = elApiKey.value;
      if (!val) return;
      navigator.clipboard.writeText(val).then(function () {
        elCopyApiKeyBtn.textContent = "복사됨!";
        elCopyApiKeyBtn.classList.add("copied");
        setTimeout(function () {
          elCopyApiKeyBtn.textContent = "복사";
          elCopyApiKeyBtn.classList.remove("copied");
        }, 1500);
      });
    });

    elSettingsForm.addEventListener("submit", async function (e) {
      e.preventDefault();

      if (elSchoolName.value.trim()) {
        var linked = await autoFillSchoolCodes(true);
        if (!linked && elApiKey.value.trim()) {
          return;
        }
      }

      settings = {
        apiKey: elApiKey.value.trim(),
        schoolName: elSchoolName.value.trim(),
        officeCode: elOfficeCode.value.trim(),
        schoolCode: elSchoolCode.value.trim(),
        lunchStart: elLunchStart.value || "12:30",
        lunchEnd: elLunchEnd.value || "13:20"
      };

      saveSettings(settings);
      elSettingsDialog.close();
      renderClock();
      refreshMeal();
    });

    elRefreshMealBtn.addEventListener("click", refreshMeal);

    elMealDateInput.addEventListener("change", function () {
      selectedMealDate = parseInputDate(elMealDateInput.value);
      refreshMeal();
    });

    elSchoolName.addEventListener("change", function () {
      autoFillSchoolCodes(false);
    });

    elMealList.addEventListener("click", function (e) {
      var target = e.target;
      if (!target || target.tagName !== "BUTTON") {
        return;
      }
      addStickerVote(target.dataset.dish, target.dataset.sticker);
    });
  }

  function init() {
    syncSettingsForm();
    bindEvents();
    elMealDateInput.value = formatInputDate(selectedMealDate);
    renderClock();
    refreshMeal();
    window.setInterval(renderClock, 1000);
  }

  init();
})();
