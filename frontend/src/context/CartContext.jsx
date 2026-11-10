import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import api from '../api/client'
import { useAuth } from './AuthContext'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const { user } = useAuth()
  const [cart, setCart] = useState(null)
  const isBuyer = user?.role === 'buyer'

  const refresh = useCallback(async () => {
    if (!isBuyer) return setCart(null)
    try {
      setCart((await api.get('/cart')).data)
    } catch {
      setCart(null)
    }
  }, [isBuyer])

  useEffect(() => { refresh() }, [refresh])

  const add = async (productId, quantity) => {
    const { data } = await api.post('/cart/items', { product_id: productId, quantity })
    setCart(data)
    return data
  }

  return (
    <CartContext.Provider value={{ cart, setCart, refresh, add, count: cart?.item_count || 0 }}>
      {children}
    </CartContext.Provider>
  )
}

export const useCart = () => useContext(CartContext)
