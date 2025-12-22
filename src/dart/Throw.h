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

    public:
        Throw()
        {
            //
        }

        uint8_t getPoints() const
        {
            return this->value * this->field;
        }

        uint8_t getValue() const
        {
            return this->value;
        }

        uint8_t getField() const
        {
            return this->field;
        }

        String getRing() const
        {
            return this->ring;
        }

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
};

#endif
