// La app se ve siempre en modo claro, aunque el dispositivo o el navegador estén en modo oscuro.
// (En móvil ya lo fuerza "userInterfaceStyle": "light" de app.json; esto hace lo mismo en la web.)
export function useColorScheme(): 'light' | 'dark' {
  return 'light';
}
