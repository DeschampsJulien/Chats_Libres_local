(function () {
  const appRoot = document.querySelector('[data-frontignan-app]');
  const configElement = document.getElementById('frontignan-config');

  if (!appRoot || !configElement || typeof window.L === 'undefined') {
    return;
  }

  const config = JSON.parse(configElement.textContent);
  const currentMode = config.currentMode === 'maison' ? 'maison' : 'chat';
  const defaultLatitude = config.defaultLatitude;
  const defaultLongitude = config.defaultLongitude;

  const errorMessage = appRoot.querySelector('[data-error-message]');
  const successToast = appRoot.querySelector('[data-success-toast]');
  const modeListTitle = appRoot.querySelector('[data-mode-list-title]');
  const modeListCount = appRoot.querySelector('[data-mode-list-count]');
  const modeList = appRoot.querySelector('[data-mode-list]');
  const modeListEmpty = appRoot.querySelector('[data-mode-list-empty]');
  const modeAddLink = appRoot.querySelector('[data-mode-add-link]');
  const googleMapsLink = appRoot.querySelector('[data-google-maps-link]');
  const showAllPointsButton = appRoot.querySelector('[data-action="show-all-points"]');
  const editChatButtons = Array.from(appRoot.querySelectorAll('[data-action="edit-chat"]'));
  const deleteChatSheetButton = appRoot.querySelector('[data-action="delete-chat-sheet"]');
  const editMaisonButtons = Array.from(appRoot.querySelectorAll('[data-action="edit-maison"]'));
  const deleteSelectedButton = appRoot.querySelector('[data-action="delete-selected"]');
  const selectedSection = appRoot.querySelector('[data-selected-section]');
  const chatFormSection = appRoot.querySelector('[data-chat-form-section]');
  const chatForm = appRoot.querySelector('[data-chat-form]');
  const maisonForm = appRoot.querySelector('[data-maison-form]');
  const mapElement = document.getElementById('leaflet-map');

  const state = {
    typeMarqueurActif: currentMode,
    lieuActifKey: null,
    lieux: [],
    leafletMap: null,
    markersLayer: null
  };

  let successToastTimeout = null;

  function createIcon(type, extraClass = '') {
    const baseClass = type === 'maison' ? 'house-marker' : 'cat-marker';
    const html = type === 'maison' ? '<div class="house-pin"></div>' : '<div class="cat-pin"></div>';

    return L.divIcon({
      className: `${baseClass}${extraClass ? ` ${extraClass}` : ''}`,
      html: html,
      iconSize: [42, 42],
      iconAnchor: [21, 34],
      popupAnchor: [0, -24]
    });
  }

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

  function getLieuKey(lieu) {
    return `${lieu.type}:${lieu.id}`;
  }

  function getLieuActif() {
    if (state.lieuActifKey) {
      return state.lieux.find((lieu) => getLieuKey(lieu) === state.lieuActifKey) || null;
    }

    return null;
  }

  function getTypeLabel(type) {
    return type === 'maison' ? 'Maison' : 'Chat';
  }

  function getLieuTitle(lieu) {
    if (!lieu) {
      return '';
    }

    if (lieu.type === 'chat') {
      return lieu.details?.dossierNumero || lieu.label || 'Dossier chat';
    }

    return lieu.nom || lieu.label || 'Maison';
  }

  function getLieuSummary(lieu) {
    if (!lieu) {
      return '';
    }

    if (lieu.type === 'chat') {
      return lieu.details?.adressePrecise || 'Aucune adresse';
    }

    return lieu.details?.adresse || 'Aucune adresse';
  }

  function getFilteredLieuxByActiveMode() {
    return state.lieux.filter((lieu) => lieu.type === state.typeMarqueurActif);
  }

  function syncActiveLieuWithMode() {
    const activeLieu = state.lieuActifKey
      ? state.lieux.find((lieu) => getLieuKey(lieu) === state.lieuActifKey) || null
      : null;

    if (activeLieu && activeLieu.type === state.typeMarqueurActif) {
      return;
    }

    const firstLieuForMode = getFilteredLieuxByActiveMode()[0] || null;
    state.lieuActifKey = firstLieuForMode ? getLieuKey(firstLieuForMode) : null;
  }

  function getGoogleMapsUrl() {
    const lieu = getLieuActif();
    const latitude = lieu ? lieu.latitude : defaultLatitude;
    const longitude = lieu ? lieu.longitude : defaultLongitude;

    return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  }

  function setErrorMessage(message) {
    errorMessage.hidden = !message;
    errorMessage.textContent = message;
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

  function fillChatForm(details) {
    const values = { ...createEmptyChatForm(), ...(details || {}) };

    Array.from(chatForm.elements).forEach((element) => {
      if (!element.name) {
        return;
      }

      if (element.name === 'etatAvancement' && element.type === 'checkbox') {
        element.checked = Array.isArray(values.etatAvancement) && values.etatAvancement.includes(element.value);
        return;
      }

      element.value = values[element.name] || '';
    });
  }

  function fillMaisonForm(lieu) {
    if (!lieu || lieu.type !== 'maison') {
      maisonForm.reset();
      return;
    }

    maisonForm.elements.nom.value = lieu.nom || '';
    maisonForm.elements.adresse.value = lieu.details?.adresse || '';
    maisonForm.elements.commentaire.value = lieu.details?.commentaire || '';
    maisonForm.elements.latitude.value = lieu.latitude ?? '';
    maisonForm.elements.longitude.value = lieu.longitude ?? '';
  }

  function getMaisonFormData() {
    return {
      nom: maisonForm.elements.nom.value.trim(),
      adresse: maisonForm.elements.adresse.value.trim(),
      commentaire: maisonForm.elements.commentaire.value.trim(),
      latitude: Number(maisonForm.elements.latitude.value),
      longitude: Number(maisonForm.elements.longitude.value)
    };
  }

  function centerOnActiveLieu() {
    const lieu = getLieuActif();

    if (!state.leafletMap || !lieu) {
      return;
    }

    state.leafletMap.panTo([lieu.latitude, lieu.longitude], {
      animate: true,
      duration: 0.35
    });
  }

  function showAllPoints() {
    const filteredLieux = getFilteredLieuxByActiveMode();

    if (!state.leafletMap || filteredLieux.length === 0) {
      return;
    }

    const points = filteredLieux.map((lieu) => [lieu.latitude, lieu.longitude]);

    if (points.length === 1) {
      state.leafletMap.setView(points[0], 14);
      return;
    }

    state.leafletMap.fitBounds(points, {
      padding: [40, 40]
    });
  }

  function updateModeList() {
    if (!modeList || !modeListTitle || !modeListCount || !modeListEmpty) {
      return;
    }

    const filteredLieux = getFilteredLieuxByActiveMode();
    const label = state.typeMarqueurActif === 'chat' ? 'Liste des chats' : 'Liste des maisons';
    const countLabel = `${filteredLieux.length} ${filteredLieux.length > 1 ? 'elements' : 'element'}`;
    const addLabel = state.typeMarqueurActif === 'chat' ? 'Ajouter un chat' : 'Ajouter une maison';
    const addUrl = state.typeMarqueurActif === 'chat' ? config.addChatUrl : config.addMaisonUrl;

    modeListTitle.textContent = label;
    modeListCount.textContent = countLabel;
    if (modeAddLink) {
      modeAddLink.textContent = addLabel;
      modeAddLink.href = addUrl;
    }
    modeList.replaceChildren();
    modeListEmpty.hidden = filteredLieux.length !== 0;

    filteredLieux.forEach((lieu) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'mode-list-item';

      if (getLieuKey(lieu) === state.lieuActifKey) {
        item.classList.add('is-active');
      }

      const name = document.createElement('span');
      name.className = 'mode-list-name';
      name.textContent = getLieuTitle(lieu);

      const summary = document.createElement('span');
      summary.className = 'mode-list-summary';
      summary.textContent = getLieuSummary(lieu);

      item.append(name, summary);
      item.addEventListener('click', () => {
        state.lieuActifKey = getLieuKey(lieu);
        setErrorMessage('');
        updateUI();
        centerOnActiveLieu();
      });

      modeList.append(item);
    });
  }

  function createLieuPopupContent(lieu) {
    const container = document.createElement('div');
    container.className = 'marker-popup-content';

    const title = document.createElement('strong');
    title.textContent = getLieuTitle(lieu);

    const type = document.createElement('span');
    type.className = 'marker-popup-text';
    type.textContent = `Type : ${getTypeLabel(lieu.type)}`;

    const summary = document.createElement('span');
    summary.className = 'marker-popup-text';
    summary.textContent = getLieuSummary(lieu);

    container.append(title, type, summary);

    return container;
  }

  async function refreshLieux() {
    const data = await requestJson('/api/lieux', {
      method: 'GET'
    });

    state.lieux = Array.isArray(data.lieux) ? data.lieux : [];

    if (!state.lieux.some((lieu) => getLieuKey(lieu) === state.lieuActifKey)) {
      state.lieuActifKey = state.lieux[0] ? getLieuKey(state.lieux[0]) : null;
    }
  }

  function getDeleteUrl(lieu) {
    return lieu.type === 'chat' ? `/api/lieux/chat/${lieu.id}` : `/api/lieux/maison/${lieu.id}`;
  }

  function getUpdateChatUrl(lieu) {
    return `/api/lieux/chat/${lieu.id}/fiche`;
  }

  function getUpdateMaisonUrl(lieu) {
    return `/api/lieux/maison/${lieu.id}`;
  }

  function getEditUrl(lieu) {
    if (!lieu) {
      return '#';
    }

    const pattern = lieu.type === 'chat' ? config.editChatBaseUrl : config.editMaisonBaseUrl;

    return pattern.replace('__ID__', String(lieu.id));
  }

  async function deleteSelectedLieu() {
    const lieu = getLieuActif();

    if (!lieu) {
      return;
    }

    if (lieu.type === 'maison') {
      const confirmed = window.confirm('Voulez-vous vraiment supprimer cette maison ?');

      if (!confirmed) {
        return;
      }
    }

    try {
      await requestJson(getDeleteUrl(lieu), {
        method: 'DELETE'
      });

      state.lieux = state.lieux.filter((item) => getLieuKey(item) !== getLieuKey(lieu));
      state.lieuActifKey = state.lieux[0] ? getLieuKey(state.lieux[0]) : null;
      updateUI();
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function deleteChatSheet() {
    const lieu = getLieuActif();

    if (!lieu || lieu.type !== 'chat') {
      return;
    }

    const confirmed = window.confirm('Voulez-vous vraiment supprimer cette fiche chat ?');

    if (!confirmed) {
      return;
    }

    await deleteSelectedLieu();
  }

  function openEditPage(type) {
    const lieu = getLieuActif();

    if (!lieu || lieu.type !== type) {
      return;
    }

    window.location.href = getEditUrl(lieu);
  }

  function updateMarkers() {
    if (!state.markersLayer) {
      return;
    }

    state.markersLayer.clearLayers();

    getFilteredLieuxByActiveMode().forEach((lieu) => {
      const isSelected = getLieuKey(lieu) === state.lieuActifKey;
      const marker = L.marker([lieu.latitude, lieu.longitude], {
        icon: createIcon(lieu.type, isSelected ? 'is-selected' : '')
      }).addTo(state.markersLayer);

      marker.bindPopup(createLieuPopupContent(lieu), {
        closeButton: true,
        maxWidth: 280
      });

      marker.on('click', () => {
        state.lieuActifKey = getLieuKey(lieu);
        setErrorMessage('');
        updateUI();
        marker.openPopup();
      });
    });
  }

  function updateActiveInfo() {
    const lieu = getLieuActif();

    if (!lieu) {
      googleMapsLink.href = `https://www.google.com/maps/search/?api=1&query=${defaultLatitude},${defaultLongitude}`;
      selectedSection.hidden = true;
      chatFormSection.hidden = true;
      maisonForm.hidden = true;
      deleteSelectedButton.hidden = true;
      editChatButtons.forEach((button) => {
        button.setAttribute('href', '#');
      });
      editMaisonButtons.forEach((button) => {
        button.setAttribute('href', '#');
      });
      return;
    }

    googleMapsLink.href = getGoogleMapsUrl();
    deleteSelectedButton.hidden = false;

    if (lieu.type === 'chat') {
      selectedSection.hidden = true;
      chatFormSection.hidden = false;
      maisonForm.hidden = true;
      fillChatForm(lieu.details || {});
      Array.from(chatForm.elements).forEach((element) => {
        element.disabled = true;
      });
      editChatButtons.forEach((button) => {
        button.setAttribute('href', getEditUrl(lieu));
      });
    } else {
      selectedSection.hidden = false;
      chatFormSection.hidden = true;
      maisonForm.hidden = false;
      fillMaisonForm(lieu);
      Array.from(maisonForm.elements).forEach((element) => {
        element.disabled = true;
      });
      editMaisonButtons.forEach((button) => {
        button.setAttribute('href', getEditUrl(lieu));
      });
    }
  }

  function updateUI() {
    updateActiveInfo();
    updateModeList();
    updateMarkers();
  }

  function initMap() {
    state.leafletMap = L.map(mapElement).setView([defaultLatitude, defaultLongitude], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(state.leafletMap);

    state.markersLayer = L.layerGroup().addTo(state.leafletMap);
  }

  function bindEvents() {
    editChatButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        openEditPage('chat');
      });
    });

    deleteChatSheetButton.addEventListener('click', () => {
      deleteChatSheet();
    });

    editMaisonButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        openEditPage('maison');
      });
    });

    deleteSelectedButton.addEventListener('click', () => {
      deleteSelectedLieu();
    });

    showAllPointsButton.addEventListener('click', () => {
      showAllPoints();
    });
  }

  async function init() {
    try {
      initMap();
      bindEvents();
      await refreshLieux();
      syncActiveLieuWithMode();
      updateUI();
      setErrorMessage('');
    } catch (error) {
      setErrorMessage(error.message || 'La carte interactive n a pas pu etre chargee.');
    }
  }

  init();
})();
