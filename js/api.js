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

  async function fetchTodayMeal(config) {
    var now = new Date();
    if (!config.apiKey || !config.officeCode || !config.schoolCode) {
      return SAMPLE_MENU;
    }

    var url = "https://open.neis.go.kr/hub/mealServiceDietInfo"
      + "?Type=json"
      + "&pIndex=1&pSize=5"
      + "&KEY=" + encodeURIComponent(config.apiKey)
      + "&ATPT_OFCDC_SC_CODE=" + encodeURIComponent(config.officeCode)
      + "&SD_SCHUL_CODE=" + encodeURIComponent(config.schoolCode)
      + "&MLSV_YMD=" + ymd(now);

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
    fetchTodayMeal: fetchTodayMeal,
    ymd: ymd
  };
})();
