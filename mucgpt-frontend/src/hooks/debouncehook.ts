import { useEffect, useState } from "react";

const useDebounce = (inputValue: string, delay: number = 500) => {
    const [debouncedValue, setDebouncedValue] = useState(inputValue);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(inputValue);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [inputValue, delay]);

    return debouncedValue;
};
export default useDebounce;
