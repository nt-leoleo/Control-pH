import { useState } from "react";

const HandleAdmin = () => {
    const [admin, setAdmin] = useState(false);

    const handleAdmin = () => {
        setAdmin(prev => !prev)
    }
}

export default HandleAdmin;
