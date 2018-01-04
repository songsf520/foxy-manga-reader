import moment from 'moment';
import * as Notification from '../util/notification';
import store from '../util/datastore';


// Document startup and event listeners
// ////////////////////////////////////////////////////////////////

const mangaListDom = document.getElementById('manga-list');

/**
 * Opens new tab with the selected manga chapter when btn-read button is clicked.
 */
async function readButtonListener(e) {
  try {
    const select = e.target.parentElement.getElementsByTagName('select')[0];
    await browser.tabs.create({ url: select.options[select.selectedIndex].dataset.url });
  } catch (err) {
    console.error(`Error while accessing chapter page: ${err}`); // eslint-disable-line no-console

    // Notify user that an error occurred
    Notification.error({
      title: browser.i18n.getMessage('readChapterButtonErrorNotificationTitle'),
      message: browser.i18n.getMessage('readChapterButtonErrorNotificationMessage'),
    });
  }
}

/**
 * Unbookmarks manga when btn-remove button is clicked.
 */
async function unbookmarkButtonListener(e) {
  const card = e.target.parentElement.parentElement;

  try {
    const result = await browser.runtime.sendMessage({
      type: 'unbookmark',
      manga_url: card.dataset.mangaUrl,
    });

    if (result) mangaListDom.removeChild(card);
  } catch (err) {
    console.error(`Error while unbookmarking manga from browser action script: ${err}`); // eslint-disable-line no-console

    // Notify user that an error occurred
    Notification.error({
      title: browser.i18n.getMessage('unbookmarkMangaErrorNotificationTitle'),
      message: browser.i18n.getMessage('unbookmarkMangaErrorNotificationmessage'),
    });
  }
}

/**
 * Listens to 'change' events on the view mode container.
 */
document.addEventListener('change', async (e) => {
  if (e.target.name !== 'viewMode') return;

  try {
    await browser.storage.sync.set({ view_mode: e.target.id });

    const container = document.getElementById('view-mode-container');
    const previousActive = container.getElementsByClassName('active')[0];

    if (previousActive) previousActive.classList.remove('active');

    e.target.parentNode.classList.add('active');
  } catch (err) {
    console.error(`Could not change the view mode: ${err}`); // eslint-disable-line no-console

    // Notify user that an error occurred
    Notification.error({
      title: browser.i18n.getMessage('changeViewModeErrorNotificationTitle'),
      message: browser.i18n.getMessage('changeViewModeErrorNotificationMessage'),
    });
  }
});


// DOM creation
// ////////////////////////////////////////////////////////////////

/**
 * Creates a new Manga <li> Element
 * @param {*} manga object defining the manga
 * @returns <li> html element
 */
function createMangaElement(bookmark, manga) {
  const upToDate = bookmark.last_read.chapter.id === manga.chapter_list[manga.chapter_list.length - 1].id;

  const mangaDiv = document.createElement('li');
  mangaDiv.id = `${bookmark.source}-${bookmark.reference}`;
  mangaDiv.className = 'manga-row flex';
  mangaDiv.dataset.mangaUrl = manga.url;
  mangaDiv.dataset.mangaSid = manga.sid;

  if (upToDate) mangaDiv.className += ' up-to-date';

  // Add cover image
  const mangaCover = document.createElement('img');
  mangaCover.src = manga.cover;
  mangaCover.width = '100';

  mangaDiv.appendChild(mangaCover);

  const mangaData = document.createElement('div');
  mangaData.className = 'manga-data';

  // Add Manga title
  const title = document.createElement('h4');
  title.textContent = manga.name;
  title.className = 'title';
  mangaData.appendChild(title);

  // Add Manga metadata
  const meta = document.createElement('span');
  meta.textContent = `Last read: ${moment(bookmark.last_read.date).format('LL')}`;
  mangaData.appendChild(meta);

  // Add chapters
  const chapterSelect = document.createElement('select');
  mangaData.appendChild(chapterSelect);
  if (upToDate) {
    chapterSelect.className = 'chapter-selector bg-success';
  } else {
    chapterSelect.className = 'chapter-selector bg-danger';
  }

  manga.chapter_list.slice().reverse().forEach((chapter) => {
    const option = document.createElement('option');
    option.value = chapter.id;
    option.text = chapter.name;
    option.dataset.url = chapter.url;

    if (chapter.id === bookmark.last_read.chapter.id) option.selected = true;

    chapterSelect.appendChild(option);
  });

  // Add Read button
  const goBtn = document.createElement('a');
  goBtn.className = 'btn btn-default btn-read';
  goBtn.innerHTML = 'Read';
  goBtn.href = '#';
  goBtn.onclick = readButtonListener;
  mangaData.appendChild(goBtn);

  // Add Remove button
  const removeBtn = document.createElement('a');
  removeBtn.className = 'btn btn-danger btn-remove';
  removeBtn.innerHTML = 'Remove';
  removeBtn.href = '#';
  removeBtn.onclick = unbookmarkButtonListener;
  mangaData.appendChild(removeBtn);

  mangaDiv.appendChild(mangaData);

  return mangaDiv;
}


// Runtime messages
// ////////////////////////////////////////////////////////////////

function updateCurrentChapter(bookmark) {
  const mangaDom = document.getElementById(`${bookmark.source}-${bookmark.reference}`);

  const meta = mangaDom.getElementsByTagName('span')[0];
  meta.textContent = `Last read: ${moment(bookmark.last_read.date).format('LL')}`;

  const chapterSel = mangaDom.getElementsByTagName('select')[0];

  chapterSel.selectedIndex = bookmark.last_read.chapter.id;

  const uptodate = bookmark.last_read.chapter.index === chapterSel.options.length - 1;
  if (uptodate) {
    chapterSel.className = 'chapter-selector bg-success';
    mangaDom.className += ' up-to-date';
  }
}

function updateChapterList(bookmark, chapterList) {
  const mangaDom = document.getElementById(`${bookmark.source}-${bookmark.reference}`);
  const wasUptodate = mangaDom.className.includes('up-to-date');

  if (wasUptodate) mangaDom.className = 'manga-row flex';

  // Modify chapters
  const chapterSel = mangaDom.getElementsByTagName('select')[0];
  if (wasUptodate) chapterSel.className = 'chapter-selector bg-danger';

  chapterSel.options.length = 0;
  chapterList.slice().reverse().forEach((chapter) => {
    const option = document.createElement('option');
    option.value = chapter.id;
    option.text = chapter.name;
    option.dataset.url = chapter.url;

    if (chapter.id === bookmark.last_read.chapter.id) option.selected = true;

    chapterSel.appendChild(option);
  });
}

browser.runtime.onMessage.addListener((message, sender) => {
  // Accept only messages from the background page
  if (sender.envType !== 'addon_child') return;

  switch (message.type) {
    case 'update-current-chapter':
      updateCurrentChapter(message.bookmark);
      break;
    case 'update-chapter-list':
      updateChapterList(message.bookmark, message.chapterList);
      break;
    default:
      break;
  }
});


// On window load
// ////////////////////////////////////////////////////////////////

/**
 * On windown.onload event, clear any badge text and create the manga
 * list DOM tree.
 */
window.onload = async () => {
  const optBtn = document.getElementById('options-btn');
  optBtn.onclick = () => { browser.runtime.openOptionsPage(); };

  try {
    // Sanity check the DOM
    if (!mangaListDom) throw new Error('manga-list element does not exist in DOM');

    const storage = await browser.storage.sync.get(['bookmark_list', 'badge_count', 'view_mode']);

    // Select view mode
    const radio = document.getElementById(storage.view_mode || 'single');
    if (radio) radio.parentNode.className += ' active';

    // Update badge_count
    if (storage && storage.badge_count > 0) {
      browser.browserAction.setBadgeBackgroundColor({ color: '' });
      browser.browserAction.setBadgeText({ text: '' });

      storage.badge_count = 0;
      await browser.storage.sync.set({ badge_count: storage.badge_count });
    }

    // console.debug(storage);

    // Append manga list
    if (storage && storage.bookmark_list) {
      storage.bookmark_list.forEach(async (bookmark) => {
        const manga = await store.getItem(`${bookmark.source}/${bookmark.reference}`);
        if (!manga) return;

        mangaListDom.appendChild(createMangaElement(bookmark, manga));
      });
    }
  } catch (err) {
    console.error(`Error while starting the browser action script: ${err}`); // eslint-disable-line no-console

    // Notify user that an error occurred
    Notification.error({
      title: browser.i18n.getMessage('generalErrorNotificationTitle'),
      message: browser.i18n.getMessage('generalErrorNotificationMessage'),
    });
  }
};
