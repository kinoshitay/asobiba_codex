(function () {
  const places = Array.isArray(window.HCMC_PARENTING_PLACES)
    ? window.HCMC_PARENTING_PLACES
    : [];

  const state = {
    query: "",
    category: "all",
    district: "all",
    map: null,
    markers: [],
  };

  const categoryLabels = {
    all: "すべて",
    park: "公園",
    school: "学校",
    hospital: "病院",
    play: "屋内あそび場",
    community: "コミュニティ",
  };

  const els = {
    searchInput: document.getElementById("searchInput"),
    categoryFilters: document.getElementById("categoryFilters"),
    districtFilters: document.getElementById("districtFilters"),
    placeList: document.getElementById("placeList"),
    resultSummary: document.getElementById("resultSummary"),
    categoryCount: document.getElementById("categoryCount"),
    placeCount: document.getElementById("placeCount"),
    mapMode: document.getElementById("mapMode"),
    mapStatus: document.getElementById("mapStatus"),
    mapCanvas: document.getElementById("mapCanvas"),
  };

  function uniqueValues(items, key) {
    return [...new Set(items.map((item) => item[key]))].sort((a, b) =>
      a.localeCompare(b, "ja")
    );
  }

  function buildChip(label, value, activeValue, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `chip${value === activeValue ? " is-active" : ""}`;
    button.textContent = label;
    button.addEventListener("click", () => onClick(value));
    return button;
  }

  function renderFilters() {
    const categories = Object.entries(categoryLabels);
    const districts = ["all", ...uniqueValues(places, "district")];

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

  function getFilteredPlaces() {
    const normalized = state.query.trim().toLowerCase();
    return places.filter((place) => {
      const matchesQuery =
        !normalized ||
        [place.name, place.categoryLabel, place.district, place.description]
          .join(" ")
          .toLowerCase()
          .includes(normalized);
      const matchesCategory =
        state.category === "all" || place.category === state.category;
      const matchesDistrict =
        state.district === "all" || place.district === state.district;
      return matchesQuery && matchesCategory && matchesDistrict;
    });
  }

  function renderPlaces(items) {
    els.placeList.innerHTML = "";

    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.innerHTML =
        "<strong>条件に合うスポットがありません。</strong><p>検索語を減らすか、地区フィルターを全地区に戻してみてください。</p>";
      els.placeList.appendChild(empty);
      return;
    }

    items.forEach((place) => {
      const card = document.createElement("article");
      card.className = "place-card";
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
        <p class="place-card__description">${place.description}</p>
        <div class="place-card__meta">
          <span>対象: ${place.ageFocus}</span>
          <span>メモ: ${place.notes}</span>
        </div>
      `;
      els.placeList.appendChild(card);
    });
  }

  function updateSummary(items) {
    const categories = new Set(items.map((item) => item.category));
    els.categoryCount.textContent = String(
      state.category === "all" ? Object.keys(categoryLabels).length - 1 : categories.size
    );
    els.placeCount.textContent = String(items.length);
    els.resultSummary.textContent = `${items.length}件を表示中`;
  }

  function clearMarkers() {
    state.markers.forEach((marker) => marker.setMap(null));
    state.markers = [];
  }

  function renderMap(items) {
    if (!window.google || !window.google.maps) {
      els.mapMode.textContent = "List";
      els.mapStatus.textContent = "Google Maps APIキー未設定";
      return;
    }

    els.mapMode.textContent = "Google";
    els.mapStatus.textContent = `${items.length}件をピン表示`;

    if (!state.map) {
      els.mapCanvas.innerHTML = "";
      state.map = new window.google.maps.Map(els.mapCanvas, {
        center: { lat: 10.7769, lng: 106.7009 },
        zoom: 11,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
    }

    clearMarkers();

    const bounds = new window.google.maps.LatLngBounds();
    items.forEach((place) => {
      const marker = new window.google.maps.Marker({
        position: { lat: place.lat, lng: place.lng },
        map: state.map,
        title: place.name,
      });

      const infoWindow = new window.google.maps.InfoWindow({
        content: `
          <div style="max-width:220px">
            <strong>${place.name}</strong><br />
            <span>${place.categoryLabel} / ${place.district}</span><br />
            <span>${place.address}</span>
          </div>
        `,
      });

      marker.addListener("click", () => infoWindow.open({ anchor: marker, map: state.map }));
      state.markers.push(marker);
      bounds.extend(marker.getPosition());
    });

    if (items.length) {
      state.map.fitBounds(bounds, 48);
    }
  }

  function render() {
    renderFilters();
    const filteredPlaces = getFilteredPlaces();
    renderPlaces(filteredPlaces);
    updateSummary(filteredPlaces);
    renderMap(filteredPlaces);
  }

  function loadGoogleMaps() {
    const apiKey = window.HCMC_PARENTING_MAP?.googleMapsApiKey || localStorage.getItem("googleMapsApiKey");
    if (!apiKey) {
      render();
      return;
    }

    const existing = document.querySelector('script[data-google-maps="true"]');
    if (existing) {
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMaps = "true";
    script.addEventListener("load", render);
    script.addEventListener("error", () => {
      els.mapStatus.textContent = "Google Mapsの読み込みに失敗しました";
      render();
    });
    document.head.appendChild(script);
  }

  els.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value;
    render();
  });

  render();
  loadGoogleMaps();
})();
