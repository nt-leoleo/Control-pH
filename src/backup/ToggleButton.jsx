const ToggleButton = ({ admin, toggleAdmin }) => {
  return (
    <button
      onClick={toggleAdmin}
      style={{
        padding: '10px 20px',
        borderRadius: '12px',
        border: 'none',
        backgroundColor: admin ? '#22C55E' : '#EF4444',
        color: '#fff',
        cursor: 'pointer'
      }}
    >
      {admin ? 'Admin ON' : 'Admin OFF'}
    </button>
  )
}

export default ToggleButton
