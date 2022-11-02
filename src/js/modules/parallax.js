/** @typedef ParallaxDetailsItem
 * @property {HTMLElement} node
 * @property {number} top
 * @property {boolean} isSticky
 * @property {HTMLElement | null} nextCover
 * @property {HTMLElement | null} previousCover
 *  */

/** @param {Element} containerElement */
// eslint-disable-next-line sonarjs/cognitive-complexity,max-statements
export function initializeParallax(containerElement) {
  const parallax = /** @type {NodeListOf<HTMLElement>} */ (
    containerElement.querySelectorAll('*[parallax]')
  );
  /** @type {ParallaxDetailsItem[]} */
  const parallaxDetails = [];
  let isSticky = false;

  // Edge requires a transform on the document body and a fixed position element
  // in order for it to properly render the parallax effect as you scroll.
  // See https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/5084491/
  if (getComputedStyle(document.body).transform === 'none') {
    document.body.style.transform = 'translateZ(0)';
  }
  const fixedPos = document.createElement('div');
  fixedPos.style.position = 'fixed';
  fixedPos.style.top = '0';
  fixedPos.style.width = '1px';
  fixedPos.style.height = '1px';
  fixedPos.style.zIndex = '1';
  document.body.insertBefore(fixedPos, document.body.firstChild);

  for (let index = 0; index < parallax.length; index += 1) {
    const element = /** @type {HTMLElement} */ (parallax[index]);
    const container = /** @type {HTMLElement} */ (element.parentNode);
    if (getComputedStyle(container).overflow !== 'visible') {
      console.error(
        'Need non-scrollable container to apply perspective for',
        element
      );
      continue;
    }
    if (containerElement && container.parentNode !== containerElement) {
      console.warn(
        'Currently we only track a single overflow clip, but elements from multiple clips found.',
        element
      );
    }
    const clipElement = /** @type {HTMLElement} */ (container.parentNode);
    if (getComputedStyle(clipElement).overflow === 'visible') {
      console.error(
        'Parent of sticky container should be scrollable element',
        element
      );
    }
    // TODO(flackr): optimize to not redo this for the same clip/container.
    /** @type {HTMLElement} */
    let perspectiveElement;
    const hasWebkitOverflowScrolling =
      // @ts-ignore
      getComputedStyle(clipElement).webkitOverflowScrolling;
    if (isSticky || hasWebkitOverflowScrolling) {
      isSticky = true;
      perspectiveElement = container;
    } else {
      perspectiveElement = clipElement;
      container.style.transformStyle = 'preserve-3d';
    }
    perspectiveElement.style.perspectiveOrigin = 'bottom right';
    perspectiveElement.style.perspective = '1px';
    if (isSticky) {
      element.style.position = '-webkit-sticky';
    }
    if (isSticky) {
      element.style.top = '0';
    }
    element.style.transformOrigin = 'bottom right';

    // Find the previous and next elements to parallax between.
    let previousCover = /** @type {HTMLElement | null} */ (
      parallax[index].previousElementSibling
    );
    while (previousCover && previousCover.hasAttribute('parallax')) {
      previousCover = /** @type {HTMLElement | null} */ (
        previousCover.previousElementSibling
      );
    }
    let nextCover = /** @type {HTMLElement | null} */ (
      parallax[index].nextElementSibling
    );
    while (nextCover && !nextCover.hasAttribute('parallax-cover')) {
      nextCover = /** @type {HTMLElement | null} */ (
        nextCover.nextElementSibling
      );
    }

    parallaxDetails.push({
      node: parallax[index],
      top: parallax[index].offsetTop,
      isSticky,
      nextCover,
      previousCover,
    });
  }

  // Add a scroll listener to hide perspective elements when they should no
  // longer be visible.
  containerElement.addEventListener('scroll', () => {
    for (let index = 0; index < parallaxDetails.length; index += 1) {
      // const container = /** @type {HTMLElement} */ (
      //   parallaxDetails[index].node.parentNode
      // );
      // const previousCover = parallaxDetails[index].previousCover;
      // const nextCover = parallaxDetails[index].nextCover;
      // const parallaxStart = previousCover
      //   ? previousCover.offsetTop + previousCover.offsetHeight
      //   : 0;
      // const parallaxEnd = nextCover
      //   ? nextCover.offsetTop
      //   : container.offsetHeight;
      // const threshold = 200;
      // const visible =
      //   parallaxStart - threshold - containerElement.clientHeight <
      //     containerElement.scrollTop &&
      //   parallaxEnd + threshold > containerElement.scrollTop;
      // FIXME: Repainting the images while scrolling can cause jank.
      // For now, keep them all.
      // const display = visible ? 'block' : 'none'
      const display = 'block';
      if (parallaxDetails[index].node.style.display !== display) {
        parallaxDetails[index].node.style.display = display;
      }
    }
  });
  window.addEventListener('resize', onResize.bind(null, parallaxDetails));
  onResize(parallaxDetails);
  for (let index = 0; index < parallax.length; index += 1) {
    const firstChild = parallax[index].parentNode?.firstChild;
    if (!firstChild) {
      continue;
    }
    parallax[index].parentNode?.insertBefore(parallax[index], firstChild);
  }
}

/** @param {Array<ParallaxDetailsItem>} details */
// eslint-disable-next-line sonarjs/cognitive-complexity
function onResize(details) {
  for (let index = 0; index < details.length; index += 1) {
    const container = /** @type {HTMLElement} */ (
      details[index].node.parentNode
    );

    const containerParentElement = /** @type {HTMLElement} */ (
      container.parentNode
    );
    if (!containerParentElement) {
      return;
    }
    const previousCover = details[index].previousCover;
    const nextCover = details[index].nextCover;
    const rate = Number(details[index].node.getAttribute('parallax'));

    const parallaxStart = previousCover
      ? previousCover.offsetTop + previousCover.offsetHeight
      : 0;
    const scrollbarWidth = details[index].isSticky
      ? 0
      : containerParentElement.offsetWidth - containerParentElement.clientWidth;
    // const parallaxElem = details[index].isSticky
    //   ? container
    //   : containerParentElement;
    const height = details[index].node.offsetHeight;
    let depth = 0;
    if (rate) {
      depth = 1 - (1 / rate);
    } else {
      const parallaxEnd = nextCover
        ? nextCover.offsetTop
        : container.offsetHeight;
      depth =
        (height - parallaxEnd + parallaxStart) /
        (height - containerParentElement.clientHeight);
    }
    if (details[index].isSticky) {
      depth = 1.0 / depth;
    }

    const scale = 1.0 / (1.0 - depth);

    // The scrollbar is included in the 'bottom right' perspective origin.
    const dx = scrollbarWidth * (scale - 1);
    // Offset for the position within the container.
    const dy = details[index].isSticky
      ? -(containerParentElement.scrollHeight - parallaxStart - height) *
        (1 - scale)
      : (parallaxStart -
          depth * (height - containerParentElement.clientHeight)) *
        scale;

    details[index].node.style.transform = `scale(${
      1 - depth
    }) translate3d(${dx}px, ${dy}px, ${depth}px)`;
  }
}
