// Etapa 1: proyecto base. Las pantallas del sistema se agregan en las siguientes etapas.
export default function App() {
  return (
    <main className="contenido">
      <div className="tarjeta" style={{ maxWidth: 560, margin: '60px auto' }}>
        <h1>Sonrisa Norte</h1>
        <p className="suave" style={{ marginTop: 8 }}>
          Sistema de gestión para clínica dental. Proyecto creado con React y Vite.
        </p>
      </div>
    </main>
  )
}
