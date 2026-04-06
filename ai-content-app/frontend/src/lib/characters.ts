export interface Character {
  id: number
  name: string
  niche: string
  instagram: string
  avatarUrl: string
  color: string
}

export const characters: Character[] = [
  {
    id: 1,
    name: 'Персонаж 1',
    niche: 'Lifestyle & Beauty',
    instagram: 'https://instagram.com/',
    avatarUrl: 'https://i.pravatar.cc/400?img=47',
    color: 'from-pink-500 to-rose-500',
  },
  {
    id: 2,
    name: 'Персонаж 2',
    niche: 'Fitness & Sport',
    instagram: 'https://instagram.com/',
    avatarUrl: 'https://i.pravatar.cc/400?img=26',
    color: 'from-violet-500 to-purple-500',
  },
  {
    id: 3,
    name: 'Персонаж 3',
    niche: 'Travel & Fashion',
    instagram: 'https://instagram.com/',
    avatarUrl: 'https://i.pravatar.cc/400?img=44',
    color: 'from-cyan-500 to-blue-500',
  },
]
