/** Все геометрические пороги взяты из ТЗ — никогда не переопределять инлайн. */

/** Минимальная длина анализируемого отрезка, px (ТЗ §3.1). */
export const MIN_SEGMENT_LENGTH = 30;

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
