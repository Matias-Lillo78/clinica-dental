import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../App'
import { registrarCuentaPaciente } from '../lib/db'
import { correoValido, rutValido } from '../lib/utils'

// Registro de cuenta del paciente (CU-01: el paciente entrega sus datos de contacto)
export default function RegistroPaciente() {
  const { setUsuario } = useAuth()
  const [f, setF] = useState({ rut: '', nombre: '', telefono: '', correo: '', direccion: '', clave: '' })
  const [errores, setErrores] = useState({})
  const [msg, setMsg] = useState('')
  const cambiar = (e) => setF({ ...f, [e.target.name]: e.target.value })

  const enviar = async (e) => {
    e.preventDefault()
    const er = {}
    if (!rutValido(f.rut)) er.rut = 'RUT inválido (formato 12345678-9).'
    if (f.nombre.trim().length < 3) er.nombre = 'Ingrese su nombre completo.'
    if (f.telefono.trim().length < 8) er.telefono = 'Ingrese un teléfono válido.'
    if (!correoValido(f.correo)) er.correo = 'Correo inválido.'
    if (f.clave.length < 8) er.clave = 'La contraseña debe tener al menos 8 caracteres.'
    setErrores(er)
    if (Object.keys(er).length) return
    try {
      const u = await registrarCuentaPaciente(f)
      if (u) setUsuario(u)
      else setMsg('Cuenta creada. Revise su correo para confirmar la cuenta y luego inicie sesión.')
    } catch (err) {
      setMsg(err.message)
    }
  }

  const campo = (name, texto, type = 'text', ph = '') => (
    <div className="campo">
      <label htmlFor={name}>{texto}</label>
      <input id={name} name={name} type={type} value={f[name]} onChange={cambiar} placeholder={ph} />
      {errores[name] && <div className="error-campo">{errores[name]}</div>}
    </div>
  )

  return (
    <div className="login-form" style={{ minHeight: '100vh' }}>
      <div className="tarjeta login-caja" style={{ width: 'min(480px, 100%)' }}>
        <h2 style={{ fontSize: '1.3rem' }}>Crear cuenta de paciente</h2>
        <p className="suave" style={{ margin: '4px 0 18px' }}>Con su cuenta podrá solicitar y cancelar citas y recibir avisos.</p>
        {msg && <div className="alerta info">{msg}</div>}
        <form onSubmit={enviar} noValidate>
          {campo('rut', 'RUT', 'text', '12345678-9')}
          {campo('nombre', 'Nombre completo')}
          <div className="grid2" style={{ gap: 12 }}>
            {campo('telefono', 'Teléfono', 'tel', '+56 9 ...')}
            {campo('correo', 'Correo', 'email')}
          </div>
          {campo('direccion', 'Dirección (opcional)')}
          {campo('clave', 'Contraseña', 'password')}
          <button className="btn" style={{ width: '100%', justifyContent: 'center' }}>Crear cuenta</button>
        </form>
        <p className="peq suave" style={{ marginTop: 14 }}><Link to="/">Volver a iniciar sesión</Link></p>
      </div>
    </div>
  )
}
