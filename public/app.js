(function () {
  const places = Array.isArray(window.HCMC_PARENTING_PLACES) ? window.HCMC_PARENTING_PLACES : [];
  const areas = Array.isArray(window.HCMC_PARENTING_AREAS) ? window.HCMC_PARENTING_AREAS : [];
  const defaultAreaId = window.HCMC_PARENTING_MAP?.defaultAreaId || "hcmc";

  const state = {
    query: "",
    age: "4",
    areaId: defaultAreaId,
    category: "play",
    district: "all",
    map: null,
    markers: []
  };

  const categoryLabels = {
    play: "屋内あそび場",
    sightseeing: "観光スポット"
  };
  const allowedCategories = new Set(Object.keys(categoryLabels));

  const els = {
    areaSelect: document.getElementById("areaSelect"),
    searchInput: document.getElementById("searchInput"),
    ageInput: document.getElementById("ageInput"),
    ageRecommendation: document.getElementById("ageRecommendation"),
    categoryFilters: document.getElementById("categoryFilters"),
    districtFilters: document.getElementById("districtFilters"),
    placeList: document.getElementById("placeList"),
    resultSummary: document.getElementById("resultSummary"),
    categoryCount: document.getElementById("categoryCount"),
    placeCount: document.getElementById("placeCount"),
    mapMode: document.getElementById("mapMode"),
    mapStatus: document.getElementById("mapStatus"),
    mapCanvas: document.getElementById("mapCanvas")
  };

  function getCurrentArea() {
    return areas.find((area) => area.id === state.areaId) || areas[0] || null;
  }

  function getAreaPlaces() {
    return places.filter(
      (place) => place.areaId === state.areaId && allowedCategories.has(place.category)
    );
  }

  function uniqueValues(items, key) {
    return [...new Set(items.map((item) => item[key]))].sort((a, b) => a.localeCompare(b, "ja"));
  }

  function buildChip(label, value, activeValue, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `chip${value === activeValue ? " is-active" : ""}`;
    button.textContent = label;
    button.addEventListener("click", () => onClick(value));
    return button;
  }

  function renderAreaSelect() {
    els.areaSelect.innerHTML = "";
    areas.forEach((area) => {
      const option = document.createElement("option");
      option.value = area.id;
      option.textContent = area.name;
      if (area.id === state.areaId) {
        option.selected = true;
      }
      els.areaSelect.appendChild(option);
    });
  }

  function renderFilters() {
    const areaPlaces = getAreaPlaces();
    const categories = Object.entries(categoryLabels);
    const districts = ["all", ...uniqueValues(areaPlaces, "district")];

    els.categoryFilters.innerHTML = "";
    categories.forEach(([value, label]) => {
      els.categoryFilters.appendChild(
        buildChip(label, value, state.category, (nextValue) => {
          state.category = nextValue;
          render();
        })
      );
    });

    els.districtFilters.innerHTML = "";
    districts.forEach((district) => {
      const label = district === "all" ? "全地区" : district;
      els.districtFilters.appendChild(
        buildChip(label, district, state.district, (nextValue) => {
          state.district = nextValue;
          render();
        })
      );
    });
  }

  function parseAgeFocus(ageFocus) {
    const match = String(ageFocus).match(/(\d+)\s*-\s*(\d+)/);
    if (!match) {
      return null;
    }

    return { min: Number(match[1]), max: Number(match[2]) };
  }

  function getRecommendationScore(place, age) {
    let score = 0;
    const ageRange = parseAgeFocus(place.ageFocus);

    if (!Number.isNaN(age) && state.age !== "") {
      if (ageRange && age >= ageRange.min && age <= ageRange.max) {
        score += 100;
      } else if (ageRange) {
        score -= 15;
      }
    }

    if (place.category === "play") {
      score += 30;
    } else if (place.category === "sightseeing") {
      score += 22;
    } else if (place.category === "park" || place.category === "community") {
      score += 18;
    } else if (place.category === "school") {
      score += 8;
    }

    return score;
  }

  function getFilteredPlaces() {
    const areaPlaces = getAreaPlaces();
    const normalized = state.query.trim().toLowerCase();
    const age = Number(state.age);

    return areaPlaces
      .filter((place) => {
        const matchesQuery =
          !normalized ||
          [place.name, place.categoryLabel, place.district, place.description, place.address]
            .join(" ")
            .toLowerCase()
            .includes(normalized);
        const matchesCategory = state.category === "all" || place.category === state.category;
        const matchesDistrict = state.district === "all" || place.district === state.district;
        return matchesQuery && matchesCategory && matchesDistrict;
      })
      .map((place) => ({
        ...place,
        recommendationScore: getRecommendationScore(place, age)
      }))
      .sort((a, b) => {
        const playPriority =
          state.age !== "" ? Number(b.category === "play") - Number(a.category === "play") : 0;

        if (playPriority !== 0) {
          return playPriority;
        }

        return b.recommendationScore - a.recommendationScore;
      });
  }

  function getRecommendationText(items) {
    const currentArea = getCurrentArea();
    const areaName = currentArea ? currentArea.shortName : "このエリア";
    const categoryName = categoryLabels[state.category] || "スポット";

    if (state.age === "") {
      return `${areaName}を初期表示しています。年齢を入れると、その都市の${categoryName}をおすすめ順に並べます。`;
    }

    const topPicks = items
      .filter((item) => item.category === state.category && item.recommendationScore >= 100)
      .slice(0, 3)
      .map((item) => item.name);

    if (!topPicks.length) {
      const fallbackPicks = items
        .filter((item) => item.category === state.category)
        .slice(0, 3)
        .map((item) => item.name);

      if (fallbackPicks.length) {
        return `${state.age}歳向けに近い${areaName}の${categoryName}: ${fallbackPicks.join(" / ")}`;
      }

      return `${state.age}歳向けに近い${areaName}の候補を表示しています。`;
    }

    return `${state.age}歳向けの${areaName}おすすめ${categoryName}: ${topPicks.join(" / ")}`;
  }

  function getGoogleMapsUrl(place) {
    const query = [place.name, place.address, getCurrentArea()?.name].filter(Boolean).join(", ");
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

  function renderPlaces(items) {
    els.placeList.innerHTML = "";

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML =
        "<strong>条件に合うスポットがありません。</strong><p>検索語や地区フィルターを見直すか、別のエリアに切り替えてみてください。</p>";
      els.placeList.appendChild(empty);
      return;
    }

    items.forEach((place) => {
      const card = document.createElement("article");
      const isRecommended = state.age !== "" && place.recommendationScore >= 100;
      const googleMapsUrl = getGoogleMapsUrl(place);
      card.className = `place-card${isRecommended ? " is-recommended" : ""}`;
      card.innerHTML = `
        <div class="place-card__top">
          <div>
            <h3>${place.name}</h3>
            <div class="place-card__meta">
              <span>${place.district}</span>
              <span>${place.address}</span>
            </div>
          </div>
          <span class="badge" data-category="${place.category}">${place.categoryLabel}</span>
        </div>
        ${isRecommended ? '<span class="recommendation-tag">この年齢におすすめ</span>' : ""}
        <p class="place-card__description">${place.description}</p>
        <div class="place-card__meta">
          <span>対象: ${place.ageFocus}</span>
          <span>メモ: ${place.notes}</span>
        </div>
        <a class="map-link" href="${googleMapsUrl}" target="_blank" rel="noreferrer">Google Mapsで開く</a>
      `;
      els.placeList.appendChild(card);
    });
  }

  function updateSummary(items) {
    const currentArea = getCurrentArea();
    const categories = new Set(items.map((item) => item.category));
    els.categoryCount.textContent = String(
      categories.size || 1
    );
    els.placeCount.textContent = String(items.length);
    els.resultSummary.textContent = `${currentArea ? currentArea.shortName : ""}で${items.length}件を表示中`;
    els.ageRecommendation.textContent = getRecommendationText(items);
  }

  function clearMarkers() {
    state.markers.forEach((marker) => marker.remove());
    state.markers = [];
  }

  function renderMap(items) {
    const currentArea = getCurrentArea();

    if (!window.L) {
      els.mapMode.textContent = "List";
      els.mapStatus.textContent = "地図ライブラリの読み込みに失敗しました";
      return;
    }

    els.mapMode.textContent = "OpenStreetMap";
    els.mapStatus.textContent = `${currentArea ? currentArea.shortName : "このエリア"}で${items.length}件をピン表示`;

    if (!state.map) {
      els.mapCanvas.innerHTML = "";
      state.map = window.L.map(els.mapCanvas, {
        zoomControl: true
      }).setView(
        currentArea ? [currentArea.center.lat, currentArea.center.lng] : [10.7769, 106.7009],
        currentArea ? currentArea.zoom : 11
      );

      window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(state.map);
    }

    clearMarkers();

    if (!items.length) {
      if (currentArea) {
        state.map.setView([currentArea.center.lat, currentArea.center.lng], currentArea.zoom);
      }
      return;
    }

    const bounds = [];
    items.forEach((place) => {
      const marker = window.L.marker([place.lat, place.lng]).addTo(state.map);
      marker.bindPopup(`
          <div style="max-width:220px">
            <strong>${place.name}</strong><br />
            <span>${place.categoryLabel} / ${place.district}</span><br />
            <span>${place.address}</span>
          </div>
        `);
      state.markers.push(marker);
      bounds.push([place.lat, place.lng]);
    });

    if (items.length === 1 && currentArea) {
      state.map.setView([items[0].lat, items[0].lng], Math.max(currentArea.zoom, 13));
      return;
    }

    state.map.fitBounds(bounds, { padding: [48, 48] });
  }

  function render() {
    renderAreaSelect();
    renderFilters();
    const filteredPlaces = getFilteredPlaces();
    renderPlaces(filteredPlaces);
    updateSummary(filteredPlaces);
    renderMap(filteredPlaces);
  }

  els.areaSelect.addEventListener("change", (event) => {
    state.areaId = event.target.value;
    state.district = "all";
    state.query = "";
    els.searchInput.value = "";
    render();
  });

  els.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value;
    render();
  });

  els.ageInput.addEventListener("input", (event) => {
    state.age = event.target.value;
    render();
  });

  render();
})();
