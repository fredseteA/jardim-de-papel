import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { collectionPresentations, type CollectionPresentation } from '../../data/collectionPresentation';
import styles from './CollectionsSection.module.css';

const cardVariant = styles.cardV1;

function CollectionCard({ collection }: { collection: CollectionPresentation }) {
  return <Link className={`${styles.card} ${cardVariant}`} to={`/colecoes/${collection.slug}`}>
    <img className={styles.image} src={collection.image} alt="" />
    <div className={styles.cardContent}><h3>{collection.title}</h3><p>{collection.description}</p><span className={styles.action}>Explorar <ArrowRight size={12} aria-hidden="true" /></span></div>
  </Link>;
}

export function CollectionsSection() {
  return <section id="colecoes" className={styles.section} aria-labelledby="collections-title">
    <div className={styles.heading}><h2 id="collections-title">Explore nossas coleções</h2></div>
    <div className={styles.scroller}>{collectionPresentations.map((collection) => <CollectionCard key={collection.id} collection={collection} />)}</div>
  </section>;
}
