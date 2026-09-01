const cards = ['Repo card', 'Change card', 'Release card']

export default function App() {
  return (
    <main className="feed">
      {cards.map((label) => (
        <section className="card" key={label}>
          <div className="card-top">GitTok</div>
          {label}
          <div className="card-bottom">placeholder</div>
        </section>
      ))}
    </main>
  )
}
