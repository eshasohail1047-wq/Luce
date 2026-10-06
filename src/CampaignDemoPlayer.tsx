/**
 * One moisturizer campaign — same white pump bottle throughout:
 * studio still → girl using it → marketing film.
 */
const PACK = [
  {
    id: 'product',
    label: 'Product',
    title: 'Daily Moisturizer',
    image: '/images/moisturizer-studio.jpg',
  },
  {
    id: 'ugc',
    label: 'UGC',
    title: 'Girl using it',
    image: '/images/moisturizer-ugc-poster.jpg',
    video: '/videos/creator-1.mp4',
  },
  {
    id: 'marketing',
    label: 'Marketing',
    title: 'Campaign film',
    image: '/images/moisturizer-ugc-poster.jpg',
    video: '/videos/creator-5.mp4',
  },
]

export default function CampaignDemoPlayer() {
  return (
    <div className="campaign-player">
      <div className="demo-pack">
        <div className="demo-pack-intro">
          <p className="demo-pack-kicker">One product campaign</p>
          <h3>Daily Moisturizer → full content pack</h3>
          <p>
            Same white pump moisturizer from the creator video — studio still, UGC, and marketing
            film in one campaign.
          </p>
        </div>
        <div className="demo-pack-grid demo-pack-grid-3">
          {PACK.map((item) => (
            <article key={item.id} className="demo-pack-card">
              <div className="demo-pack-media">
                {item.video ? (
                  <video
                    src={item.video}
                    poster={item.image}
                    muted
                    loop
                    playsInline
                    autoPlay
                    preload="auto"
                  />
                ) : (
                  <img src={item.image} alt={item.title} />
                )}
                <span>{item.label}</span>
              </div>
              <strong>{item.title}</strong>
            </article>
          ))}
        </div>
      </div>
    </div>
  )
}
