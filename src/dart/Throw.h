#ifndef Throw_h
#define Throw_h

#include <Arduino.h>


class Throw
{
    private:
    protected:
        uint8_t value;
        uint8_t field;
        String ring;
        float x;
        float y;

    public:
        Throw()
        {
            //
        }

        uint8_t getPoints()
        {
            return this->value * this->field;
        }

        uint8_t getValue();
        uint8_t getField();
        String getRing();
        float getX();
        float getY();

        void setValue(uint8_t value)
        {
            this->value = value;
        }

        void setField(uint8_t field)
        {
            this->field = field;
        }

        void setRing(String ring)
        {
            this->ring = ring;
        }

        void setX(float x)
        {
            this->x = x;
        }

        void setY(float y)
        {
            this->y = y;
        }
};

#endif
