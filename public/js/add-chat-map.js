(function () {
  const appRoot = document.querySelector('[data-add-chat-app]');
  const configElement = document.getElementById('add-chat-config');

  if (!appRoot || !configElement || typeof window.L === 'undefined') {
    return;
  }

  const config = JSON.parse(configElement.textContent);
  const defaultLatitude = config.defaultLatitude;
  const defaultLongitude = config.defaultLongitude;

  const errorMessage = appRoot.querySelector('[data-error-message]');
  const successToast = appRoot.querySelector('[data-success-toast]');
  const saveChatButtons = Array.from(appRoot.querySelectorAll('[data-action="save-chat"]'));
  const chatForm = appRoot.querySelector('[data-chat-form]');
  const coordinatesLabel = appRoot.querySelector('[data-selected-coordinates]');
  const helpText = appRoot.querySelector('[data-add-chat-help]');
  const geocodeStatus = appRoot.querySelector('[data-geocode-status]');
  const mapElement = document.getElementById('add-chat-map');

  const state = {
    latitude: null,
    longitude: null,
    map: null,
    marker: null
  };

  let successToastTimeout = null;
  let reverseGeocodeRequestId = 0;

  function createEmptyChatForm() {
    return {
      dossierNumero: '',
      trappageDate: '',
      trappageHeure: '',
      adressePrecise: '',
      commune: '',
      typeLieu: '',
      autreTypeLieu: '',
      nomEntrepriseParticulier: '',
      trappageTelephone: '',
      colonieSite: '',
      signalementNom: '',
      signalementTelephone: '',
      signalementEmail: '',
      statutChat: '',
      proprietaireNom: '',
      proprietaireAdresse: '',
      proprietaireTelephone: '',
      chatNourri: '',
      nourrissageType: '',
      nourrisseurNom: '',
      nourrisseurTelephone: '',
      sterilise: '',
      dateSterilisation: '',
      identificationType: '',
      identificationNumero: '',
      veterinaireNom: '',
      clinique: '',
      financementType: '',
      financementAutre: '',
      nomAttribue: '',
      sexe: '',
      ageApprox: '',
      couleurRobe: '',
      typePelage: '',
      couleurYeux: '',
      signesParticuliers: '',
      photo: '',
      photoReference: '',
      etatGeneral: '',
      comportement: '',
      observations: '',
      orientation: '',
      lieuRelachement: '',
      dateRelachement: '',
      etatAvancement: [],
      nomTrappeur: '',
      associationCollectif: ''
    };
  }

  function createIcon() {
    return L.divIcon({
      className: 'cat-marker is-selected',
      html: '<div class="cat-pin"></div>',
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
    }, 2600);
  }

  function getChatFormData() {
    const formData = new FormData(chatForm);
    const values = createEmptyChatForm();

    for (const [key, value] of formData.entries()) {
      if (key === 'etatAvancement') {
        values.etatAvancement.push(value);
        continue;
      }

      values[key] = value;
    }

    return values;
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

    if (state.latitude === null || state.longitude === null) {
      coordinatesLabel.textContent = 'Aucun point selectionne';
      helpText.hidden = false;
      return;
    }

    coordinatesLabel.textContent = `${state.latitude}, ${state.longitude}`;
    helpText.hidden = true;
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

    updateSelectedCoordinates();
  }

  function fillAddressFields(result) {
    const address = result.address || {};
    const adressePrecise = chatForm.elements.adressePrecise;
    const commune = chatForm.elements.commune;
    const road = address.road || address.pedestrian || address.cycleway || address.footway || '';
    const streetAddress = [address.house_number, road].filter(Boolean).join(' ').trim();
    const city = address.city || address.town || address.village || address.municipality || '';

    if (adressePrecise) {
      adressePrecise.value = streetAddress || result.display_name || '';
    }

    if (commune) {
      commune.value = city;
    }
  }

  async function fillAddressFromPoint(latitude, longitude) {
    const requestId = ++reverseGeocodeRequestId;

    setGeocodeStatus('Recherche automatique de l adresse...');

    try {
      const result = await reverseGeocode(latitude, longitude);

      if (requestId !== reverseGeocodeRequestId) {
        return;
      }

      fillAddressFields(result);
      setGeocodeStatus(result.display_name ? 'Adresse detectee automatiquement.' : '');
    } catch (error) {
      if (requestId !== reverseGeocodeRequestId) {
        return;
      }

      setGeocodeStatus('Adresse non trouvee automatiquement pour ce point.', true);
    }
  }

  function initMap() {
    state.map = L.map(mapElement).setView([defaultLatitude, defaultLongitude], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(state.map);

    state.map.on('click', (event) => {
      const latitude = Number(event.latlng.lat.toFixed(6));
      const longitude = Number(event.latlng.lng.toFixed(6));

      setErrorMessage('');
      placeMarker(latitude, longitude);
      fillAddressFromPoint(latitude, longitude);
    });

    updateSelectedCoordinates();
  }

  async function saveChat() {
    if (state.latitude === null || state.longitude === null) {
      setErrorMessage('Cliquez d abord sur la carte pour positionner le chat.');
      return;
    }

    try {
      const details = getChatFormData();
      const dossierField = chatForm.elements.dossierNumero;
      const adresseField = chatForm.elements.adressePrecise;

      clearFieldError(dossierField);
      clearFieldError(adresseField);

      if (!details.dossierNumero.trim()) {
        setErrorMessage('');
        showFieldError(dossierField, 'Le numero de dossier est obligatoire.');
        return;
      }

      if (!details.adressePrecise.trim()) {
        setErrorMessage('');
        showFieldError(adresseField, 'L adresse est obligatoire.');
        return;
      }

      await requestJson('/api/lieux', {
        method: 'POST',
        body: JSON.stringify({
          type: 'chat',
          latitude: state.latitude,
          longitude: state.longitude,
          nom: details.dossierNumero ? `Dossier ${details.dossierNumero}` : '',
          details: details
        })
      });

      chatForm.reset();
      if (state.marker) {
        state.map.removeLayer(state.marker);
        state.marker = null;
      }

      state.latitude = null;
      state.longitude = null;
      reverseGeocodeRequestId += 1;
      updateSelectedCoordinates();
      setErrorMessage('');
      setGeocodeStatus('');
      showSuccessPopup('Le nouveau chat a bien ete enregistre.');
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  function bindEvents() {
    chatForm.addEventListener('input', (event) => {
      clearFieldError(event.target);
    });

    saveChatButtons.forEach((button) => {
      button.addEventListener('click', () => {
        saveChat();
      });
    });
  }

  function init() {
    initMap();
    bindEvents();
  }

  init();
})();
