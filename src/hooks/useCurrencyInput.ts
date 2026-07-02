
'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useApp } from '@/lib/provider';

interface UseCurrencyInputProps {
  onValueChange?: (value: number) => void;
}

// --- Number to Words Converter (Indian Numbering System) ---
const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function convertLessThanThousand(n: number): string {
  let result = '';
  if (n >= 100) {
    result += ones[Math.floor(n / 100)] + ' Hundred ';
    n %= 100;
  }
  if (n >= 20) {
    result += tens[Math.floor(n / 10)] + ' ';
    n %= 10;
  } else if (n >= 10) {
    result += teens[n - 10] + ' ';
    n = 0;
  }
  if (n > 0) {
    result += ones[n] + ' ';
  }
  return result;
}

function convertIntegerToWords(num: number): string {
    if (num === 0) return '';

    let result = '';
    const numStr = Math.floor(num).toString();

    if (numStr.length > 7) {
        const crore = parseInt(numStr.slice(0, -7));
        result += convertIntegerToWords(crore) + 'Crore ';
    }

    if (numStr.length > 5) {
        const lakh = parseInt(numStr.slice(-7, -5));
        if (lakh > 0) {
            result += convertLessThanThousand(lakh) + 'Lakh ';
        }
    }
    
    if (numStr.length > 3) {
        const thousand = parseInt(numStr.slice(-5, -3));
        if (thousand > 0) {
            result += convertLessThanThousand(thousand) + 'Thousand ';
        }
    }

    const hundred = parseInt(numStr.slice(-3));
    if (hundred > 0) {
        result += convertLessThanThousand(hundred);
    }
    
    return result;
}


function numberToWords(num: number): string {
    if (num === 0) return 'Zero Rupees';
    if (num < 0) return 'Negative ' + numberToWords(Math.abs(num));

    const integerPart = Math.floor(num);
    const decimalPart = Math.round((num - integerPart) * 100);

    let integerWords = '';
    if (integerPart > 0) {
        integerWords = convertIntegerToWords(integerPart).trim() + ' Rupees';
    }

    let decimalWords = '';
    if (decimalPart > 0) {
        decimalWords = convertLessThanThousand(decimalPart).trim() + ' Paise';
    }

    let result = '';
    if (integerWords && decimalWords) {
        result = integerWords + ' and ' + decimalWords;
    } else {
        result = integerWords || decimalWords;
    }

    // Capitalize first letter of each word
    return result.trim().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');
}
// --- End of Converter ---


// Simple and safe arithmetic evaluation
const evaluate = (expr: string): number | null => {
  try {
    // Only allow numbers and basic operators. This is a simple sanitization.
    if (/[^0-9+\-*/. ]/.test(expr)) {
      return null;
    }
    // Using Function constructor is safer than eval()
    return new Function(`return ${expr}`)();
  } catch (error) {
    return null;
  }
};

export function useCurrencyInput({ onValueChange }: UseCurrencyInputProps) {
  const { settings } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);

  const getLocaleParts = useCallback(() => {
    const formatter = new Intl.NumberFormat(settings.locale, {
      style: 'decimal',
    });
    const parts = formatter.formatToParts(12345.67);
    const group = parts.find((part) => part.type === 'group')?.value || ',';
    const decimal = parts.find((part) => part.type === 'decimal')?.value || '.';
    return { group, decimal };
  }, [settings.locale]);
  
  const [localeParts, setLocaleParts] = useState(getLocaleParts);

  useEffect(() => {
    setLocaleParts(getLocaleParts());
  }, [settings.locale, getLocaleParts]);

  const [formattedValue, setFormattedValue] = useState<string>('');
  const [calculationResult, setCalculationResult] = useState<string | null>(null);
  const [amountInWords, setAmountInWords] = useState<string | null>(null);
  const [lastExpression, setLastExpression] = useState<string | null>(null);

  const format = useCallback((num: number): string => {
      if (isNaN(num)) return '';
      const formatter = new Intl.NumberFormat(settings.locale, {
          style: 'decimal',
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
      });
      return formatter.format(num);
  }, [settings.locale]);

  const processValue = useCallback((value: string) => {
    const trimmedValue = value.trim();
    const simpleNumber = /^-?\d[\d.,]*$/.test(trimmedValue);
    const isExpression = /[+\-*/]/.test(trimmedValue);
    setFormattedValue(value);

    let numericResult: number | null = null;

    if (simpleNumber) {
      const { decimal, group } = getLocaleParts();
      const cleanValue = trimmedValue
        .replace(new RegExp(`\\${group}`, 'g'), '')
        .replace(decimal, '.')
        .replace(/,/g, '');
      const parsedValue = parseFloat(cleanValue);
      if (!Number.isNaN(parsedValue)) {
        numericResult = parsedValue;
      }
      setCalculationResult(null);
      setLastExpression(null);
    } else if (isExpression) {
      const result = evaluate(trimmedValue);
      if (result !== null && isFinite(result)) {
        numericResult = result;
        setCalculationResult(format(result));
        setLastExpression(trimmedValue);
      } else {
        setCalculationResult(null);
      }
    } else {
      setCalculationResult(null);
      setLastExpression(null);
      const { decimal, group } = getLocaleParts();
      const cleanValue = trimmedValue.replace(new RegExp(`\\${group}`, 'g'), '').replace(decimal, '.');
      const parsedValue = parseFloat(cleanValue);
      if (!Number.isNaN(parsedValue)) {
        numericResult = parsedValue;
      }
    }

    if (numericResult !== null) {
        setAmountInWords(numberToWords(numericResult));
        if (onValueChange) {
            onValueChange(numericResult);
        }
    } else {
        setAmountInWords(null);
        if (onValueChange) {
            onValueChange(0);
        }
    }

  }, [onValueChange, format, getLocaleParts]);
  
  const handleBlur = useCallback(() => {
    const currentValue = formattedValue;
    const isExpression = /[+\-*/]/.test(currentValue);

    if (isExpression) {
      const result = evaluate(currentValue);
      if (result !== null && isFinite(result)) {
        setFormattedValue(format(result));
        setCalculationResult(null);
        if (onValueChange) {
          onValueChange(result);
        }
      }
    } else {
      const { decimal, group } = localeParts;
      const cleanValue = currentValue.replace(new RegExp(`\\${group}`, 'g'), '').replace(decimal, '.');
      const numericValue = parseFloat(cleanValue);
      if (!isNaN(numericValue)) {
        setFormattedValue(format(numericValue));
      } else if (currentValue === '') {
        setAmountInWords(null);
      }
    }
  }, [formattedValue, localeParts, onValueChange, format]);

  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    processValue(event.target.value);
  }, [processValue]);
  
  const setValue = useCallback((value: string) => {
    processValue(value);
  }, [processValue]);

  return {
    inputRef,
    formattedValue,
    handleInputChange,
    handleBlur,
    calculationResult,
    setValue,
    amountInWords,
    lastExpression,
  };
}
