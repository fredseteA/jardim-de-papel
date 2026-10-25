import styles from './BottomCornerDecorations.module.css';

export function BottomCornerDecorations() {
  return <div className={styles.decorations} aria-hidden="true"><img className={styles.left} src="/assets/decorations/bottom-foliage-left.webp" alt="" /><img className={styles.right} src="/assets/decorations/bottom-foliage-right.webp" alt="" /></div>;
}
