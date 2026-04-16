(function () {
  const appRoot = document.querySelector('[data-edit-house-app]');
  const configElement = document.getElementById('edit-maison-config');

  if (!appRoot || !configElement || typeof window.L === 'undefined') {
    return;
  }

  const config = JSON.parse(configElement.textContent);
  const initialMaison = config.maison || {};

  const errorMessage = appRoot.querySelector('[data-error-message]');
  const successToast = appRoot.querySelector('[data-success-toast]');
  const saveHouseButtons = Array.from(appRoot.querySelectorAll('[data-action="save-house"]'));
  const houseForm = appRoot.querySelector('[data-house-form]');
  const coordinatesLabel = appRoot.querySelector('[data-selected-coordinates]');
  const helpText = appRoot.querySelector('[data-edit-house-help]');
  const geocodeStatus = appRoot.querySelector('[data-geocode-status]');
  const mapElement = document.getElementById('edit-house-map');

  const state = {
    latitude: Number(initialMaison.latitude ?? config.defaultLatitude),
    longitude: Number(initialMaison.longitude ?? config.defaultLongitude),
    map: null,
    marker: null
  };

  let successToastTimeout = null;
  let reverseGeocodeRequestId = 0;

  function createIcon() {
    return L.divIcon({
      className: 'house-marker is-selected',
      html: '<div class="house-pin"></div>',
      iconSize: [42, 42],
      iconAnchor: [21, 34]
    });
  }

  function setErrorMessage(message) {
    errorMessage.hidden = !message;
    errorMessage.textContent = message;
  }

  function clearFieldError(field) {
    if (!field) {
      return;
    }

    field.setCustomValidity('');
  }

  function showFieldError(field, message) {
    if (!field) {
      return false;
    }

    field.setCustomValidity(message);
    field.reportValidity();
    field.focus();

    return true;
  }

  function showSuccessPopup(message) {
    if (!successToast) {
      return;
    }

    if (successToastTimeout) {
      window.clearTimeout(successToastTimeout);
    }

    successToast.textContent = message;
    successToast.hidden = false;
    successToast.classList.add('is-visible');

    successToastTimeout = window.setTimeout(() => {
      successToast.classList.remove('is-visible');
      successToast.hidden = true;
    }, 1800);
  }

  async function requestJson(url, options) {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json'
      },
      ...options
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || 'Une erreur est survenue.');
    }

    return data;
  }

  async function reverseGeocode(latitude, longitude) {
    const url = new URL('https://nominatim.openstreetmap.org/reverse');
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('lat', latitude);
    url.searchParams.set('lon', longitude);
    url.searchParams.set('addressdetails', '1');

    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Adresse introuvable pour ce point.');
    }

    return response.json();
  }

  function setGeocodeStatus(message, isError = false) {
    if (!geocodeStatus) {
      return;
    }

    geocodeStatus.hidden = !message;
    geocodeStatus.textContent = message;
    geocodeStatus.dataset.state = isError ? 'error' : 'info';
  }

  function updateSelectedCoordinates() {
    if (!coordinatesLabel || !helpText) {
      return;
    }

    coordinatesLabel.textContent = `${state.latitude}, ${state.longitude}`;
    helpText.hidden = true;
  }

  function syncPositionFields() {
    houseForm.elements.latitude.value = state.latitude ?? '';
    houseForm.elements.longitude.value = state.longitude ?? '';
  }

  function placeMarker(latitude, longitude) {
    state.latitude = latitude;
    state.longitude = longitude;

    if (state.marker) {
      state.marker.setLatLng([latitude, longitude]);
    } else {
      state.marker = L.marker([latitude, longitude], {
        icon: createIcon()
      }).addTo(state.map);
    }

    syncPositionFields();
    updateSelectedCoordinates();
  }

  function fillAddressField(result) {
    const addressField = houseForm.elements.adresse;

    if (!addressField) {
      return;
    }

    addressField.value = result.display_name || '';
  }

  async function fillAddressFromPoint(latitude, longitude) {
    const requestId = ++reverseGeocodeRequestId;

    setGeocodeStatus('Recherche automatique de l adresse...');

    try {
      const result = await reverseGeocode(latitude, longitude);

      if (requestId !== reverseGeocodeRequestId) {
        return;
      }

      fillAddressField(result);
      setGeocodeStatus(result.display_name ? 'Adresse detectee automatiquement.' : '');
    } catch (error) {
      if (requestId !== reverseGeocodeRequestId) {
        return;
      }

      setGeocodeStatus('Adresse non trouvee automatiquement pour ce point.', true);
    }
  }

  function initMap() {
    state.map = L.map(mapElement).setView([state.latitude, state.longitude], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(state.map);

    placeMarker(state.latitude, state.longitude);

    state.map.on('click', (event) => {
      const latitude = Number(event.latlng.lat.toFixed(6));
      const longitude = Number(event.latlng.lng.toFixed(6));

      setErrorMessage('');
      placeMarker(latitude, longitude);
      fillAddressFromPoint(latitude, longitude);
    });
  }

  async function saveHouse() {
    const nomField = houseForm.elements.nom;
    const adresseField = houseForm.elements.adresse;
    const nom = nomField.value.trim();
    const adresse = adresseField.value.trim();

    clearFieldError(nomField);
    clearFieldError(adresseField);

    if (!nom) {
      setErrorMessage('');
      showFieldError(nomField, 'Le nom de la maison est obligatoire.');
      return;
    }

    if (!adresse) {
      setErrorMessage('');
      showFieldError(adresseField, 'L adresse de la maison est obligatoire.');
      return;
    }

    try {
      await requestJson(config.updateUrl, {
        method: 'PUT',
        body: JSON.stringify({
          nom: nom,
          adresse: adresse,
          commentaire: houseForm.elements.commentaire.value.trim(),
          latitude: state.latitude,
          longitude: state.longitude
        })
      });

      setErrorMessage('');
      showSuccessPopup('La fiche maison a bien ete modifiee.');
      window.setTimeout(() => {
        window.location.href = config.backUrl;
      }, 900);
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  function fillInitialData() {
    houseForm.elements.nom.value = initialMaison.nom || '';
    houseForm.elements.adresse.value = initialMaison.adresse || '';
    houseForm.elements.commentaire.value = initialMaison.commentaire || '';
    syncPositionFields();
  }

  function bindEvents() {
    houseForm.addEventListener('input', (event) => {
      clearFieldError(event.target);
    });

    saveHouseButtons.forEach((button) => {
      button.addEventListener('click', () => {
        saveHouse();
      });
    });
  }

  function init() {
    fillInitialData();
    initMap();
    updateSelectedCoordinates();
    bindEvents();
  }

  init();
})();
