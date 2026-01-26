import ToggleButton from './ToggleButton.jsx'
import ConfigButton from './ConfigButton.jsx'

const Buttons = ({ onToggle, onConfig }) => {
  return (
    <>
      <ToggleButton onToggle={onToggle} />
      <ConfigButton onConfig={onConfig} />
    </>
  )
}

export default Buttons;
