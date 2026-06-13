(function () {
  var STORAGE_KEY = "meal-go-settings";

  var defaultSettings = {
    apiKey: "",
    schoolName: "",
    officeCode: "",
    schoolCode: "",
    lunchStart: "12:30",
    lunchEnd: "13:20"
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

  var settings = readSettings();

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

  var elTimerMinutes = document.getElementById("timerMinutes");
  var elExtraTimerDisplay = document.getElementById("extraTimerDisplay");
  var elTimerStartBtn = document.getElementById("timerStartBtn");
  var elTimerPauseBtn = document.getElementById("timerPauseBtn");
  var elTimerResetBtn = document.getElementById("timerResetBtn");

  var extraTimerLeftSeconds = 10 * 60;
  var extraTimerId = null;
  var selectedMealDate = new Date();

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

  function renderMeal(data) {
    elMealDate.textContent = "날짜: " + window.MealApi.ymd(selectedMealDate);
    elMealList.innerHTML = "";

    data.items.forEach(function (item) {
      var li = document.createElement("li");
      var left = document.createElement("span");
      var right = document.createElement("span");
      left.textContent = item.name;
      right.textContent = item.kcal;
      li.appendChild(left);
      li.appendChild(right);
      elMealList.appendChild(li);
    });

    elMealCalories.textContent = data.totalCalories;
    elMealAllergy.textContent = data.allergy;
    elMealStatus.textContent = data.source === "neis" ? "NEIS 실데이터를 불러왔습니다." : "설정 정보가 없어 샘플 급식을 표시합니다.";
  }

  async function refreshMeal() {
    elMealStatus.textContent = "급식 정보를 불러오는 중...";
    var meal = await window.MealApi.fetchTodayMeal(settings, window.MealApi.ymd(selectedMealDate));
    renderMeal(meal);
  }

  function renderExtraTimer() {
    elExtraTimerDisplay.textContent = window.LunchClock.secondsToMMSS(extraTimerLeftSeconds);
  }

  function resetExtraTimerFromInput() {
    var minutes = Number(elTimerMinutes.value);
    if (!Number.isFinite(minutes) || minutes < 1) {
      minutes = 10;
      elTimerMinutes.value = "10";
    }
    if (minutes > 120) {
      minutes = 120;
      elTimerMinutes.value = "120";
    }
    extraTimerLeftSeconds = minutes * 60;
    renderExtraTimer();
  }

  function startExtraTimer() {
    if (extraTimerId) {
      return;
    }
    extraTimerId = window.setInterval(function () {
      if (extraTimerLeftSeconds <= 0) {
        window.clearInterval(extraTimerId);
        extraTimerId = null;
        window.alert("타이머가 종료되었습니다!");
        return;
      }
      extraTimerLeftSeconds -= 1;
      renderExtraTimer();
    }, 1000);
  }

  function pauseExtraTimer() {
    if (extraTimerId) {
      window.clearInterval(extraTimerId);
      extraTimerId = null;
    }
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
      var nextSettings = {
        apiKey: elApiKey.value.trim(),
        schoolName: elSchoolName.value.trim(),
        officeCode: elOfficeCode.value.trim(),
        schoolCode: elSchoolCode.value.trim(),
        lunchStart: elLunchStart.value || "12:30",
        lunchEnd: elLunchEnd.value || "13:20"
      };

      if (nextSettings.apiKey && nextSettings.schoolName) {
        elMealStatus.textContent = "학교 정보를 조회하는 중...";
        var schoolInfo = await window.MealApi.findSchoolByName(nextSettings.apiKey, nextSettings.schoolName);
        if (!schoolInfo) {
          window.alert("학교 정보를 찾지 못했습니다. 학교 이름을 다시 확인해 주세요.");
          return;
        }
        nextSettings.schoolName = schoolInfo.schoolName;
        nextSettings.officeCode = schoolInfo.officeCode;
        nextSettings.schoolCode = schoolInfo.schoolCode;
        elSchoolName.value = schoolInfo.schoolName;
        elOfficeCode.value = schoolInfo.officeCode;
        elSchoolCode.value = schoolInfo.schoolCode;
      }

      settings = nextSettings;
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

    elTimerMinutes.addEventListener("change", function () {
      pauseExtraTimer();
      resetExtraTimerFromInput();
    });

    elTimerStartBtn.addEventListener("click", startExtraTimer);
    elTimerPauseBtn.addEventListener("click", pauseExtraTimer);
    elTimerResetBtn.addEventListener("click", function () {
      pauseExtraTimer();
      resetExtraTimerFromInput();
    });
  }

  function init() {
    syncSettingsForm();
    bindEvents();
    elMealDateInput.value = formatInputDate(selectedMealDate);
    resetExtraTimerFromInput();
    renderClock();
    refreshMeal();
    window.setInterval(renderClock, 1000);
  }

  init();
})();
