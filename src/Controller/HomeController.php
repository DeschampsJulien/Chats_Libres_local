<?php

namespace App\Controller;

use App\Entity\FicheChat;
use App\Entity\FicheMaison;
use Doctrine\DBAL\Connection;
use Symfony\Bridge\Doctrine\Attribute\MapEntity;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Routing\Attribute\Route;

final class HomeController extends AbstractController
{
    #[Route('/', name: 'app_home')]
    public function index(): Response
    {
        return $this->render('home/landing.html.twig', [
            'app_name' => 'Chats Libres',
        ]);
    }

    #[Route('/mode/{mode}', name: 'app_home_mode', requirements: ['mode' => 'chat|maison'])]
    public function mode(string $mode): Response
    {
        return $this->renderModePage($mode);
    }

    #[Route('/ajouter/chat', name: 'app_home_add_chat')]
    public function addChat(): Response
    {
        return $this->render('home/add_chat.html.twig', [
            'app_name' => 'Chats Libres',
        ]);
    }

    #[Route('/ajouter/maison', name: 'app_home_add_maison')]
    public function addMaison(): Response
    {
        return $this->render('home/add_maison.html.twig', [
            'app_name' => 'Chats Libres',
        ]);
    }

    #[Route('/modifier/chat/{id}', name: 'app_home_edit_chat')]
    public function editChat(#[MapEntity(id: 'id')] FicheChat $ficheChat): Response
    {
        return $this->render('home/edit_chat.html.twig', [
            'app_name' => 'Chats Libres',
            'chat' => [
                'id' => $ficheChat->getId(),
                'latitude' => $ficheChat->getLatitude(),
                'longitude' => $ficheChat->getLongitude(),
                'details' => $ficheChat->toArray(),
            ],
        ]);
    }

    #[Route('/modifier/maison/{id}', name: 'app_home_edit_maison')]
    public function editMaison(#[MapEntity(id: 'id')] FicheMaison $maison): Response
    {
        return $this->render('home/edit_maison.html.twig', [
            'app_name' => 'Chats Libres',
            'maison' => [
                'id' => $maison->getId(),
                'nom' => $maison->getNom(),
                'adresse' => $maison->getAdresse(),
                'commentaire' => $maison->getCommentaire(),
                'latitude' => $maison->getLatitude(),
                'longitude' => $maison->getLongitude(),
            ],
        ]);
    }

    #[Route('/mentions-legales', name: 'app_mentions_legales')]
    public function mentionsLegales(): Response
    {
        return $this->render('home/mentions_legales.html.twig', [
            'app_name' => 'Chats Libres',
        ]);
    }

    #[Route('/test-db')]
    public function test(Connection $connection): Response
    {
        try {
            $connection->executeQuery('SELECT 1');
            return new Response('DB OK');
        } catch (\Exception $e) {
            return new Response($e->getMessage());
        }
    }

    private function renderModePage(string $mode): Response
    {
        $currentMode = $mode === 'maison' ? 'maison' : 'chat';

        return $this->render('home/mode.html.twig', [
            'app_name' => 'Chats Libres',
            'current_mode' => $currentMode,
        ]);
    }

    #[Route('/ping')]
public function ping(): Response
{
    return new Response('OK');
}
}
