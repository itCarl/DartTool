#ifndef dartGame_h
#define dartGame_h

#include "DartGameStatus.h"

class DartGame
{
    protected:
        DartGameStatus status = DartGameStatus::unkown;

    public:
        DartGame();

};

#endif
