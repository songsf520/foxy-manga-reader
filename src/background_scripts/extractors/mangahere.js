import HttpRequest from '../../util/httpRequest';

/**
 * Matches the URL of a manga page.
 */
export const urlRegex = /(?:https*:\/\/[\w.]*)*(mangahere)\.\w{2,3}\/manga\/([\w_]+)\//;

/**
 * Returns the chapter reference extracted from the URL or the defaultValue.
 * @param {string} url The URL of the chapter reference to return.
 * @param {Object} defaultValue Optional. A default value in case no chapter reference could be recovered.
 * @returns A string representing the chapter reference extracted from the URL or the defaultValue.
 */
export function getChapterReference(url, defaultValue) {
  const m = /[\w:/.]+\/manga\/\w+\/([\dc.]+)\/(?:\d+\.html)*/.exec(url);
  return (m) ? { id: m[1] } : defaultValue;
}

/**
 * Returns the manga chapter list
 * @param {object} manga The manga to retrieve its chapters
 * @param {array} chapterList A default chapterList array to start from. Defaults to an empty array
 * @returns {array} The array of chapter objects.
 */
function getChapterList(mangaSid, mangaUrl, chapterList = []) {
  const url = `http://www.mangahere.cc/get_chapters${mangaSid}.js`;

  return HttpRequest(url, (response) => {
    const regex = /\["(.+)","[\w./"+]+\/([c\d.]+)\/"\]/g;

    const body = response.body.innerHTML;
    if (!body) return chapterList;

    let m = regex.exec(body);
    while (m !== null) {
      chapterList.push({
        id: m[2],
        name: m[1],
        url: new URL(`${m[2]}/`, mangaUrl).toString(),
      });

      m = regex.exec(body);
    }

    return chapterList;
  });
}

/**
 * Returns the manga information
 * @param {string} url The URL for the manga.
 * @returns {Promise} A promise which resolves to the manga object retrieved.
 */
export function getMangaInfo(url) {
  // Sanity check
  if (!url) return null;

  // Get information from url
  let m = urlRegex.exec(url);
  if (!m) return Promise.reject(Error(`Invalid url for mangahere: ${url}`));

  const mangaUrl = m[0];
  const mangaReference = m[2];

  // Return a promise which resolves to the manga data
  return HttpRequest(mangaUrl, async (response) => {
    if (!response || typeof response !== 'object') {
      throw new Error(`MangaHere response is not a HTML: ${response}`);
    }

    const headerDom = response.getElementsByTagName('head')[0];

    // Get manga name from response
    const titleDom = response.evaluate('//meta[@property="og:title"]', headerDom, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    if (!titleDom.singleNodeValue) throw new Error('MangaHere: could not find DOM with property og:title');

    const name = titleDom.singleNodeValue.getAttribute('content');

    // Get manga SID and image URL from response
    const imageDom = response.evaluate('//div[contains(@class,"manga_detail_top clearfix")]/img', response, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
    if (!imageDom.singleNodeValue) throw new Error('MangaHere: could not find <img> DOM with "manga_detail_top" class');

    const imageUrl = imageDom.singleNodeValue.getAttribute('src');

    m = /\S+\/manga\/(\d+)\S+/.exec(imageUrl);
    if (!m) throw new Error('Could not extract SID information from MangaHere response object');

    const sid = m[1];

    // Get chapter list and return
    try {
      const chapterList = await getChapterList(sid, mangaUrl);

      // Create the manga object
      const manga = {
        sid,
        name,
        source: 'mangahere',
        reference: mangaReference,
        url: mangaUrl,
        cover: imageUrl,
        last_update: new Date(),
        chapter_list: chapterList,
      };

      return manga;
    } catch (err) {
      throw new Error(`Error while retrieving chapter list: ${err}`);
    }
  });
}

/**
 * Updates the current chapter list for a manga. Also returns the number of new chapters found
 * @param {object} manga The manga to update.
 * @returns {object} The updated manga object.
 */
export async function updateChapters(manga) {
  try {
    const chapterList = await getChapterList(manga.sid, manga.url);

    const data = {
      count: chapterList.length - manga.chapter_list.length,
      chapterList,
    };

    return data;
  } catch (err) {
    throw new Error(`Error while retrieving chapter list: ${err}`);
  }
}
