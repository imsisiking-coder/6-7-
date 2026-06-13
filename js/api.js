(function () {
  var SAMPLE_MENU = {
    items: [
      { name: "흑미밥", kcal: "280 kcal" },
      { name: "미역국", kcal: "45 kcal" },
      { name: "닭갈비", kcal: "420 kcal" },
      { name: "무생채", kcal: "30 kcal" },
      { name: "사과", kcal: "80 kcal" }
    ],
    totalCalories: "855 kcal",
    allergy: "계란, 우유, 대두(샘플 데이터)",
    source: "sample"
  };

  function ymd(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, "0");
    var d = String(date.getDate()).padStart(2, "0");
    return "" + y + m + d;
  }

  function cleanMenuText(raw) {
    return raw
      .replace(/<br\s*\/?/gi, "\n")
      .replace(/\([^)]*\)/g, "")
      .split("\n")
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
  }

  function sumCalories(items) {
    var total = 0;
    for (var i = 0; i < items.length; i += 1) {
      var match = items[i].kcal.match(/\d+/);
      if (match) {
        total += Number(match[0]);
      }
    }
    return total > 0 ? total + " kcal" : "정보 없음";
  }

  async function findSchoolByName(apiKey, schoolName) {
    var trimmedName = (schoolName || "").trim();
    if (!apiKey || !trimmedName) {
      return null;
    }

    var url = "https://open.neis.go.kr/hub/schoolInfo"
      + "?Type=json"
      + "&pIndex=1&pSize=20"
      + "&KEY=" + encodeURIComponent(apiKey)
      + "&SCHUL_NM=" + encodeURIComponent(trimmedName);

    try {
      var response = await fetch(url);
      if (!response.ok) {
        return null;
      }

      var json = await response.json();
      var hasRows = json.schoolInfo && json.schoolInfo[1] && json.schoolInfo[1].row && json.schoolInfo[1].row.length > 0;
      if (!hasRows) {
        return null;
      }

      var rows = json.schoolInfo[1].row;
      var normalized = trimmedName.replace(/\s+/g, "");
      var selected = rows.find(function (row) {
        return String(row.SCHUL_NM || "").replace(/\s+/g, "") === normalized;
      }) || rows[0];

      return {
        schoolName: selected.SCHUL_NM,
        officeCode: selected.ATPT_OFCDC_SC_CODE,
        schoolCode: selected.SD_SCHUL_CODE
      };
    } catch (error) {
      return null;
    }
  }

  async function fetchTodayMeal(config, mealDateYmd) {
    var targetYmd = mealDateYmd || ymd(new Date());
    if (!config.apiKey || !config.officeCode || !config.schoolCode) {
      return SAMPLE_MENU;
    }

    var url = "https://open.neis.go.kr/hub/mealServiceDietInfo"
      + "?Type=json"
      + "&pIndex=1&pSize=5"
      + "&KEY=" + encodeURIComponent(config.apiKey)
      + "&ATPT_OFCDC_SC_CODE=" + encodeURIComponent(config.officeCode)
      + "&SD_SCHUL_CODE=" + encodeURIComponent(config.schoolCode)
      + "&MLSV_YMD=" + targetYmd;

    try {
      var response = await fetch(url);
      if (!response.ok) {
        return SAMPLE_MENU;
      }
      var json = await response.json();
      if (!json.mealServiceDietInfo || !json.mealServiceDietInfo[1] || !json.mealServiceDietInfo[1].row || json.mealServiceDietInfo[1].row.length === 0) {
        return SAMPLE_MENU;
      }

      var row = json.mealServiceDietInfo[1].row[0];
      var dishNames = cleanMenuText(row.DDISH_NM || "");
      var kcalText = row.CAL_INFO || "정보 없음";
      var allergy = row.ALLERGY_INFO || "정보 없음";
      var kcalValues = kcalText.split("<br/>").map(function (s) { return s.trim(); }).filter(Boolean);

      var items = dishNames.map(function (dish, idx) {
        return {
          name: dish,
          kcal: kcalValues[idx] || "-"
        };
      });

      return {
        items: items,
        totalCalories: sumCalories(items),
        allergy: allergy,
        source: "neis"
      };
    } catch (error) {
      return SAMPLE_MENU;
    }
  }

  window.MealApi = {
    findSchoolByName: findSchoolByName,
    fetchTodayMeal: fetchTodayMeal,
    ymd: ymd
  };
})();
