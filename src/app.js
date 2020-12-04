/* 
  
  STATE

*/
import {Spotify} from './spotify.js';
import {UI} from './ui.js';

export const CUMULIO_PLAYLIST = '0GIFfPsuHdZUQGrGvKiXSm';
const spotify = new Spotify();
export const ui = new UI(spotify);

let customEventsActive = false;
let activeDashboard = null;

const dashboards = {
  kaggle: '8edf0005-6493-48e1-9689-5740a1829cdd',
  playlist: 'b9254071-560a-4140-9d20-91ec388d35ab',
  cumulio: 'f3555bce-a874-4924-8d08-136169855807',
  cumulio_songInfo: 'e92c869c-2a94-406f-b18f-d691fd627d34',
  kaggle_songInfo: '3f5d2cb6-9a8a-43e4-83d4-9c3dae66a194'
};

const pageInfo = {
  songs: {title: 'Songs visualized' , name: 'songs'},
  cumulio_visualized: {title: 'Cumul.io playlist visualized', name: 'cumulio-playlist-viz'},
  cumulio_playlist: {title: 'Cumul.io playlist', name: 'cumulio-playlist'},
  select_playlist: {title: 'Select a playlist to visualize', name: 'my-playlists-viz'},
  my_playlist: {title: 'My Playlists', name: 'my-playlists'},
  how: {title: 'How we built it?', name: 'information'}
    
};

const dashboardOptions = {
  dashboardId: dashboards.kaggle,
  container: '#dashboard-container',
  loader: {
    background: '#111b31',
    spinnerColor: '#f44069',
    spinnerBackground: '#0d1425',
    fontColor: '#ffffff'
  }
};

/* 
  
  START

*/

window.onload = async () => {
  spotify.spotifyParams = getHashParams();
  if (!spotify.spotifyParams.access_token) return ui.setLoginStatus(false);
  spotify.makeSpotifyRequest('https://api.spotify.com/v1/me', 'get')
    .then(response => {
      if (response.error) ui.setLoginStatus(false);
      else ui.setLoginStatus(true, response);
    });

  openPageSongAnalytics();
};

export const closeSongInfoModal = () => ui.closeSongInfoModal();
export const resetModalWidth = () => ui.resetModalWidth();

export const openPageSongAnalytics = () => {
  toggleCustomEventListeners(true);
  ui.openPage(pageInfo.songs.title, pageInfo.songs.name);
  loadDashboard(dashboards.kaggle);
};

export const openPageCumulioFavorites = async () => {
  ui.openPage(pageInfo.cumulio_visualized.title, pageInfo.cumulio_visualized.name);
  toggleCustomEventListeners(true);
  loadDashboard(dashboards.cumulio);
};

export const openPageMyPlaylistsVisualized = async () => {
  if (!spotify.user.loggedIn) return location.href = '/login';
  ui.openPage(pageInfo.select_playlist.title, pageInfo.select_playlist.name);
  const playlists = await spotify.getPlaylists();
  const playlistsEl = document.getElementById('playlists-list');
  playlistsEl.innerHTML = '';
  const container = ui.generatePlaylistCards(playlists, openPageVisualizePlaylist);
  playlistsEl.append(container);
};

export const openPageCumulioPlaylist = async () => {
  ui.openPage(pageInfo.cumulio_playlist.title, pageInfo.cumulio_playlist.name);
  const playlistEl = await ui.generatePlaylistSongList({id: CUMULIO_PLAYLIST, name: 'Cumul.io Playlist'});
  const container = document.getElementById('playlists-list');
  container.innerHTML = '';
  container.append(playlistEl);
};

export const openPageMyPlaylists = async () => {
  if (!spotify.user.loggedIn) return window.location.href = '/login';
  ui.openPage(pageInfo.my_playlist.title, pageInfo.my_playlist.name);
  const playlists = await spotify.getPlaylists();
  const playlistsEl = document.getElementById('playlists-list');
  playlistsEl.innerHTML = '';
  const container = ui.generatePlaylistCards(playlists, openPagePlaylist);
  playlistsEl.append(container);
};

export const openPageVisualizePlaylist = async (playlist) => {
  ui.openPage(playlist.name || 'Playlist', pageInfo.select_playlist.name);
  const token = await getDashboardAuthorizationToken({ playlistId: playlist.id });
  ui.removePlaylists();
  loadDashboard(dashboards.playlist, token.id, token.token);
};

export const openPagePlaylist = async (playlist) => {
  ui.openPage(playlist.name || 'Playlist', pageInfo.my_playlist.name);
  removeDashboard();
  const playlistEl = await ui.generatePlaylistSongList(playlist);
  const container = document.getElementById('playlists-list');
  container.innerHTML = '';
  container.append(playlistEl);
};

export const openPageInformation = async () => {
  ui.openPage(pageInfo.how.title, pageInfo.how.name);
  removeDashboard();
  const container = document.getElementById('playlists-list');
  container.innerHTML = `
    <div class="d-block">
      <div>Lorum ipsum... blood sweat & tears and ...</div>
      <div>Spotify API</div>
    </div>
  `;
};

/* 
  
  CUMUL.IO FUNCTIONS

*/

const loadDashboard = (id, key, token, container) => {
  dashboardOptions.dashboardId = id;
  dashboardOptions.container = container || '#dashboard-container';
  // use tokens if available
  if (key && token) {
    dashboardOptions.key = key;
    dashboardOptions.token = token;
  }

  // add the dashboard to the #dashboard-container element
  activeDashboard = Cumulio.addDashboard(dashboardOptions);
};

export const removeDashboard = () => {
  Cumulio.removeDashboard(activeDashboard);
};

const getSong = (event) => {
  let songName;
  let songArtist;
  let songId;
  if (event.data.columns === undefined) {
    songName = event.data.name.id.split('&id=')[0];
    songId = event.data.name.id.split('&id=')[1];
  }
  else {
    songName = event.data.columns[0].value;
    songArtist = event.data.columns[1].value;
    songId = event.data.columns[event.data.columns.length - 1].value;
  }
  return {id: songId, name: songName, artist: songArtist};
};

const toggleCustomEventListeners = (boolean) => {
  if (customEventsActive && !boolean) {
    Cumulio.offCustomEvent();
  }
  else if (!customEventsActive && boolean) {
    Cumulio.onCustomEvent(async (event) => {
      const song = getSong(event);
      if (event.data.event === 'add_to_playlist') {
        await ui.addToPlaylistSelector(song.name, song.id);
      }
      else if (event.data.event === 'song_info') {
        const dashboardId = (event.dashboard === dashboards.cumulio) ? dashboards.cumulio_songInfo : dashboards.kaggle_songInfo;
        const token = await getDashboardAuthorizationToken({ songId: [song.id] });
        loadDashboard(dashboardId, token.id, token.token, '#song-info-dashboard');
        await ui.displaySongInfo(song);
      }
    });
  }
  customEventsActive = boolean;
};

// Function to retrieve the dashboard authorization token from the platform's backend
const getDashboardAuthorizationToken = async (metadata) => {
  try {
    const body = {
      access_token: spotify.spotifyParams.access_token,
    };
    if (metadata && typeof metadata === 'object') {
      Object.keys(metadata).forEach(key => {
        body[key] = metadata[key];
      });
    }

    /*
      Make the call to the backend API, using the platform user access credentials in the header
      to retrieve a dashboard authorization token for this user
    */
    const response = await fetch('/authorization', {
      method: 'post',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' }
    });

    // Fetch the JSON result with the Cumul.io Authorization key & token
    const responseData = await response.json();
    return responseData;
  }
  catch (e) {
    return { error: 'Could not retrieve dashboard authorization token.' };
  }
};

/* 
  
  HELPER FUNCTIONS

*/

function getHashParams() {
  const hashParams = {};
  let e;
  const r = /([^&;=]+)=?([^&;]*)/g;
  const q = window.location.hash.substring(1);
  // eslint-disable-next-line no-cond-assign
  while (e = r.exec(q)) {
    hashParams[e[1]] = decodeURIComponent(e[2]);
  }
  return hashParams;
}