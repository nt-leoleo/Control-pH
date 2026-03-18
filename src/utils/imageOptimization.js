/**
 * Utilidades para Optimización de Imágenes
 * Mejora LCP (Largest Contentful Paint) y performance general
 */

/**
 * Lazy loading de imágenes con Intersection Observer
 * @param {string} selector - Selector CSS de las imágenes
 */
export const lazyLoadImages = (selector = 'img[data-src]') => {
  if ('IntersectionObserver' in window) {
    const imageObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          const src = img.getAttribute('data-src');
          const srcset = img.getAttribute('data-srcset');
          
          if (src) {
            img.src = src;
            img.removeAttribute('data-src');
          }
          
          if (srcset) {
            img.srcset = srcset;
            img.removeAttribute('data-srcset');
          }
          
          img.classList.add('loaded');
          observer.unobserve(img);
        }
      });
    }, {
      rootMargin: '50px 0px',
      threshold: 0.01
    });

    document.querySelectorAll(selector).forEach(img => {
      imageObserver.observe(img);
    });
  } else {
    // Fallback para navegadores sin soporte
    document.querySelectorAll(selector).forEach(img => {
      const src = img.getAttribute('data-src');
      if (src) img.src = src;
    });
  }
};

/**
 * Preload de imágenes críticas
 * @param {string[]} urls - Array de URLs de imágenes
 */
export const preloadImages = (urls) => {
  urls.forEach(url => {
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = url;
    document.head.appendChild(link);
  });
};

/**
 * Genera srcset responsive para imágenes
 * @param {string} baseUrl - URL base de la imagen
 * @param {number[]} widths - Array de anchos
 * @returns {string} - String srcset
 */
export const generateSrcSet = (baseUrl, widths = [320, 640, 960, 1280, 1920]) => {
  return widths
    .map(width => `${baseUrl}?w=${width} ${width}w`)
    .join(', ');
};

/**
 * Componente de imagen optimizada
 */
export const OptimizedImage = ({ 
  src, 
  alt, 
  className = '', 
  loading = 'lazy',
  width,
  height,
  ...props 
}) => {
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={loading}
      decoding="async"
      width={width}
      height={height}
      {...props}
    />
  );
};

/**
 * Detecta soporte de WebP
 * @returns {Promise<boolean>}
 */
export const supportsWebP = () => {
  return new Promise((resolve) => {
    const webP = new Image();
    webP.onload = webP.onerror = () => {
      resolve(webP.height === 2);
    };
    webP.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
  });
};

/**
 * Obtiene la URL optimizada de la imagen
 * @param {string} url - URL original
 * @param {Object} options - Opciones de optimización
 * @returns {string} - URL optimizada
 */
export const getOptimizedImageUrl = async (url, options = {}) => {
  const {
    width,
    height,
    quality = 80,
    format = 'auto'
  } = options;

  const isWebPSupported = await supportsWebP();
  const finalFormat = format === 'auto' ? (isWebPSupported ? 'webp' : 'jpg') : format;

  let optimizedUrl = url;
  const params = new URLSearchParams();

  if (width) params.append('w', width);
  if (height) params.append('h', height);
  if (quality) params.append('q', quality);
  if (finalFormat) params.append('fm', finalFormat);

  if (params.toString()) {
    optimizedUrl += `?${params.toString()}`;
  }

  return optimizedUrl;
};

/**
 * Blur placeholder para imágenes
 * @param {string} src - URL de la imagen
 * @returns {string} - Data URL del placeholder
 */
export const generateBlurPlaceholder = (src) => {
  // Genera un placeholder blur simple
  return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'%3E%3Cfilter id='b' color-interpolation-filters='sRGB'%3E%3CfeGaussianBlur stdDeviation='20'/%3E%3C/filter%3E%3Cimage preserveAspectRatio='none' filter='url(%23b)' x='0' y='0' height='100%25' width='100%25' href='${src}'/%3E%3C/svg%3E`;
};
