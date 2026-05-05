import { GetServerSideProps } from 'next'

// The Overview dashboard is the landing page.
// This redirect is server-side so there is no flash of evaluate UI.
export const getServerSideProps: GetServerSideProps = async () => {
  return { redirect: { destination: '/dashboard', permanent: false } }
}

export default function Home() {
  return null
}
