import React from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import VideoPlayer from '../components/VideoPlayer';

/** Full-page player route: `/player/:id?se=&ep=&res=`. */
export default function Player() {
  const { id = '' } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();

  return (
    <VideoPlayer
      titleId={id}
      season={Number(sp.get('se')) || 0}
      episode={Number(sp.get('ep')) || 0}
      requestedRes={Number(sp.get('res')) || 0}
      variant="full"
      onBack={() => nav(-1)}
    />
  );
}
