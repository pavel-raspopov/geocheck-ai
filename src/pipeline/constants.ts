/** Все геометрические пороги взяты из ТЗ — никогда не переопределять инлайн. */

/** Минимальная длина анализируемого отрезка, px (ТЗ §3.1). */
export const MIN_SEGMENT_LENGTH = 30;

/** Максимальная сторона изображения для анализа: больше — даунскейл (бюджет ≤ 3 s, ТЗ §1). */
export const MAX_IMAGE_DIMENSION = 1600;

/** Кластеризация при разности углов ≤ 5° (ТЗ §3.2). */
export const CLUSTER_ANGLE_DEG = 5;

/** …и евклидовом расстоянии ≤ 7 px (ТЗ §3.2). */
export const CLUSTER_DISTANCE = 7;

/** Привязка буквы к ближайшей вершине в радиусе 40 px (ТЗ §3.2). */
export const LABEL_RADIUS = 40;

/** Погрешность движка по умолчанию, ε = 3.0 (ТЗ §3.3). */
export const EPS_DEFAULT = 3.0;

/** Округление чисел в сообщениях (ТЗ §5: «84.12° … 5.88°»). */
export const MESSAGE_DECIMALS = 2;

/* --- Внутренние параметры CV-стадий (не из ТЗ; подобраны на синтетике) --- */

/** Нижний порог Canny перед Hough (стадия lines). */
export const CANNY_LOW = 50;

/** Верхний порог Canny перед Hough (стадия lines). */
export const CANNY_HIGH = 150;

/** Минимальное число голосов в аккумуляторе HoughLinesP. */
export const HOUGH_THRESHOLD = 30;

/** Максимальный разрыв точек внутри отрезка HoughLinesP, px. */
export const HOUGH_MAX_GAP = 8;

/* --- Параметры OCR-стадии (не из ТЗ; tesseract.js v7) --- */

/** Языковая модель OCR (eng = латиница). */
export const OCR_LANG = 'eng';

/** Допустимые метки вершин: строго одиночные заглавные латинские буквы (ТЗ §3.1). */
export const OCR_CHAR_WHITELIST = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Минимальная уверенность распознавания символа, %. */
export const OCR_MIN_CONFIDENCE = 60;

/** Page segmentation mode 6 = «однородный блок текста» (внутренний параметр;
 * psm 11 «sparse» теряет одиночные метки рядом с линиями — проверено на
 * синтетических чертежах Фазы 4; psm 6 читает все метки). */
export const OCR_PSM = '6';

/** DPI-подсказка, чтобы tesseract не отклонял изображение как слишком мелкое. */
export const OCR_USER_DPI = '96';

/* --- Внутренние параметры стадии graph (не из ТЗ; подобраны на синтетике) --- */

/** Знаменатель в формуле пересечения прямых ниже этого значения → параллельны. */
export const INTERSECTION_DENOM_EPS = 1e-9;

/** Пересечение прямых засчитывается, если точка отстоит от отрезка не более чем на это, px. */
export const ON_SEGMENT_TOLERANCE = 2;

/** Радиус слияния совпадающих точек-кандидатов в одну вершину, px. */
export const VERTEX_MERGE_RADIUS = 5;
